import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { Effect } from "effect";
import { makeUnavailableSnapshot, normalizeWindow, type QuotaSnapshot } from "@kuota/core";

interface JsonRecord {
  [key: string]: unknown;
}

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "quota"
  );
}

function groupId(value: string): string {
  if (/^gemini models?$/i.test(value)) return "gemini";
  if (/^claude and gpt(?: models?)?$/i.test(value)) return "claude-gpt";
  return slug(value);
}

function validFraction(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Parses agy >=1.1.11's structured `-p /usage --output-format json` response. */
export function parseAntigravityUsageReport(raw: unknown): QuotaSnapshot {
  const data = record(raw);
  const command = record(data?.command);
  const payload = record(command?.data);
  if (data?.status !== "SUCCESS" || command?.name !== "usage" || !Array.isArray(payload?.groups)) {
    throw new Error("INVALID_USAGE_REPORT");
  }

  const windows: QuotaSnapshot["windows"][number][] = [];
  const seen = new Set<string>();
  for (const group of payload.groups) {
    const info = record(group);
    if (!info || !Array.isArray(info.buckets)) continue;
    const family = groupId(
      typeof info.name === "string"
        ? info.name
        : typeof info.display_name === "string"
          ? info.display_name
          : "quota",
    );
    for (const bucket of info.buckets) {
      const value = record(bucket);
      if (!value || value.disabled === true) continue;
      const nested = record(value.remaining);
      const remaining =
        value.remaining_fraction ??
        nested?.remaining_fraction ??
        (nested?.case === "remainingFraction" ? nested.value : undefined);
      if (!validFraction(remaining)) continue;
      const cadence =
        typeof value.window === "string"
          ? slug(value.window)
          : typeof value.id === "string"
            ? slug(value.id)
            : "quota";
      const name = `${family}.${cadence}`;
      const windowId = seen.has(name)
        ? `${name}:${slug(String(value.id ?? value.bucket_id ?? "additional"))}`
        : name;
      seen.add(windowId);
      windows.push(
        normalizeWindow({
          windowId,
          usedPercent: Number(((1 - remaining) * 100).toFixed(2)),
          resetAt: value.reset_time ?? value.resetTime,
        }),
      );
    }
  }
  if (windows.length === 0) throw new Error("NO_MEASURED_QUOTA");
  return {
    provider: "antigravity",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    source: "agy-cli-print",
    windows,
    errorCode: null,
  };
}

/** Version strings with suffixes are intentionally rejected to avoid guessing support. */
export function parseAgyVersion(value: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)\s*$/.exec(value.trim());
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  return major > 1 || (major === 1 && (minor > 1 || (minor === 1 && patch >= 11)));
}

type AgyFailureCode =
  | "BINARY_NOT_FOUND"
  | "AUTH_REQUIRED"
  | "TIMEOUT"
  | "OUTPUT_TOO_LARGE"
  | "PROTOCOL_ERROR"
  | "UNSUPPORTED_VERSION"
  | "CLI_FAILED";

class AgyProbeError extends Error {
  constructor(readonly code: AgyFailureCode) {
    super(code);
  }
}

interface ProcessOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  maxOutputBytes: number;
}

/** Bound subprocess output and lifetime; never print raw stdout/stderr or OAuth URLs. */
function execute(binary: string, args: string[], options: ProcessOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: options.cwd,
      env: options.env,
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let stderr = "";
    let settled = false;

    const stop = (): void => {
      if (child.pid && process.platform !== "win32") {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          /* already gone */
        }
      } else {
        try {
          child.kill("SIGTERM");
        } catch {
          /* already gone */
        }
      }
    };
    const finish = (error?: AgyProbeError): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stop();
      if (error) reject(error);
      else resolve(Buffer.concat(chunks).toString("utf8"));
    };
    const timer = setTimeout(() => finish(new AgyProbeError("TIMEOUT")), options.timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > options.maxOutputBytes) finish(new AgyProbeError("OUTPUT_TOO_LARGE"));
      else if (!settled) chunks.push(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 4096) stderr += chunk.toString("utf8").slice(0, 4096 - stderr.length);
    });
    child.once("error", (error: NodeJS.ErrnoException) =>
      finish(new AgyProbeError(error.code === "ENOENT" ? "BINARY_NOT_FOUND" : "CLI_FAILED")),
    );
    child.once("close", (code) => {
      if (code === 0) finish();
      else if (/not logged in|authentication required|sign.?in|please visit/i.test(stderr)) {
        finish(new AgyProbeError("AUTH_REQUIRED"));
      } else finish(new AgyProbeError("CLI_FAILED"));
    });
  });
}

export interface AgyOptions {
  binary?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

/** No new account login. Existing agy credentials only, guarded from browser launch and auto-update. */
export function readAntigravity(options: AgyOptions = {}): Effect.Effect<QuotaSnapshot> {
  return Effect.promise(async () => {
    const directory = await mkdtemp(join(tmpdir(), "kuota-agy-"));
    try {
      const script = "#!/bin/sh\nexit 1\n";
      for (const name of ["open", "xdg-open", "browser"]) {
        await writeFile(join(directory, name), script, { mode: 0o700 });
      }
      const env = { ...process.env };
      delete env.ANTIGRAVITY_OAUTH_CREDENTIALS_JSON;
      env.AGY_CLI_DISABLE_AUTO_UPDATE = "true";
      env.PATH = `${directory}${delimiter}${process.env.PATH ?? ""}`;
      env.BROWSER = join(directory, "browser");
      const binary = options.binary ?? "agy";
      const context = { cwd: directory, env };
      const version = await execute(binary, ["--version"], {
        ...context,
        timeoutMs: 3000,
        maxOutputBytes: 8192,
      });
      if (!parseAgyVersion(version)) throw new AgyProbeError("UNSUPPORTED_VERSION");
      const text = await execute(
        binary,
        ["-p", "/usage", "--output-format", "json", "--print-timeout", "90s"],
        {
          ...context,
          timeoutMs: options.timeoutMs ?? 20000,
          maxOutputBytes: options.maxOutputBytes ?? 1024 * 1024,
        },
      );
      try {
        return parseAntigravityUsageReport(JSON.parse(text));
      } catch {
        throw new AgyProbeError("PROTOCOL_ERROR");
      }
    } catch (error) {
      const code = error instanceof AgyProbeError ? error.code : "CLI_FAILED";
      const status = code === "AUTH_REQUIRED" ? "unauthenticated" : "unavailable";
      return makeUnavailableSnapshot("antigravity", code, status);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
