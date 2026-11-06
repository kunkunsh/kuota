import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { makeUnavailableSnapshot, normalizeWindow, type QuotaSnapshot } from "@kuota/core";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function validPercent(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/** Only a Claude subscription OAuth token works; MCP-only and API keys are not quota tokens. */
export function extractClaudeOAuthToken(raw: unknown, now = Date.now()): string | null {
  const oauth = record(record(raw)?.claudeAiOauth);
  const token = oauth?.accessToken;
  const expiresAt = oauth?.expiresAt;
  if (typeof token !== "string" || !token.trim() || !validExpiry(expiresAt, now)) return null;
  return token.trim();
}

function validExpiry(value: unknown, now: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > now;
}

/** Claude API reports utilization (used percent), not remaining percent. */
export function parseClaudeOAuthUsage(raw: unknown): QuotaSnapshot {
  const payload = record(raw);
  if (!payload) throw new Error("INVALID_CLAUDE_USAGE");
  const windows: QuotaSnapshot["windows"][number][] = [];
  const add = (windowId: string, value: unknown): void => {
    const data = record(value);
    if (!validPercent(data?.utilization)) return;
    windows.push(
      normalizeWindow({ windowId, usedPercent: data.utilization, resetAt: data.resets_at }),
    );
  };

  add("session.5h", payload.five_hour);
  if (validPercent(record(payload.seven_day)?.utilization)) add("weekly.all", payload.seven_day);
  else add("weekly.oauth-apps", payload.seven_day_oauth_apps);
  add("weekly.sonnet", payload.seven_day_sonnet);
  add("weekly.opus", payload.seven_day_opus);
  for (const key of [
    "seven_day_routines",
    "seven_day_claude_routines",
    "claude_routines",
    "routines",
    "seven_day_cowork",
    "cowork",
  ]) {
    if (validPercent(record(payload[key])?.utilization)) {
      add("weekly.routines", payload[key]);
      break;
    }
  }

  if (Array.isArray(payload.limits)) {
    const seen = new Set<string>();
    for (const entry of payload.limits) {
      const limit = record(entry);
      const model = record(record(limit?.scope)?.model);
      if (limit?.kind !== "weekly_scoped" || !validPercent(limit.percent)) continue;
      const name =
        typeof model?.display_name === "string"
          ? model.display_name
          : typeof model?.id === "string"
            ? model.id
            : "";
      const id = slug(name);
      if (!id || id === "all-models") continue;
      const windowId = `weekly.${id}`;
      if (seen.has(windowId) || windows.some((w) => w.windowId === windowId)) continue;
      seen.add(windowId);
      windows.push(
        normalizeWindow({ windowId, usedPercent: limit.percent, resetAt: limit.resets_at }),
      );
    }
  }

  return {
    provider: "claude",
    source: "claude-oauth-usage",
    status: windows.length ? "ok" : "unavailable",
    fetchedAt: new Date().toISOString(),
    windows,
    errorCode: windows.length ? null : "NO_MEASURED_QUOTA",
  };
}

export interface ClaudeOptions {
  /** Manually provided existing Claude Code OAuth token; never use Anthropic API keys here. */
  token?: string;
  credentialsFile?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const MAX_BODY = 1024 * 1024;

/** Read at most 1 MiB, without placing raw HTTP error responses in logs or JSON output. */
async function readBoundedResponse(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const buffers: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY) throw new Error("RESPONSE_TOO_LARGE");
      buffers.push(value);
    }
    const joined = new Uint8Array(total);
    let offset = 0;
    for (const buffer of buffers) {
      joined.set(buffer, offset);
      offset += buffer.byteLength;
    }
    return new TextDecoder().decode(joined);
  } finally {
    reader.releaseLock();
  }
}

async function resolveToken(options: ClaudeOptions): Promise<string | null> {
  if (options.token) return options.token.trim() || null;
  const fromEnvironment = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (fromEnvironment?.trim()) return fromEnvironment.trim();

  if (options.credentialsFile) {
    try {
      return extractClaudeOAuthToken(JSON.parse(await readFile(options.credentialsFile, "utf8")));
    } catch {
      return null;
    }
  }

  try {
    const file = join(homedir(), ".claude", ".credentials.json");
    const token = extractClaudeOAuthToken(JSON.parse(await readFile(file, "utf8")));
    if (token) return token;
  } catch {
    // Continue to platform-specific credential store
  }

  if (process.platform === "darwin") {
    try {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);
      const { stdout } = await execFileAsync(
        "security",
        ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
        { timeout: 2000, encoding: "utf8" },
      );
      if (stdout?.trim()) {
        const token = extractClaudeOAuthToken(JSON.parse(stdout.trim()));
        if (token) return token;
      }
    } catch {
      // Keychain item not found or unavailable
    }
  }

  return null;
}

/** No Keychain UI access, credential refresh, browser sign-in or CLI session side effects. */
export function readClaude(options: ClaudeOptions = {}): Effect.Effect<QuotaSnapshot> {
  return Effect.promise(async () => {
    const token = await resolveToken(options);
    if (!token) return makeUnavailableSnapshot("claude", "AUTH_REQUIRED", "unauthenticated");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
    try {
      const request = (url: string, agent: string): Promise<Response> =>
        (options.fetchImpl ?? fetch)(url, {
          method: "GET",
          redirect: "error",
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            "anthropic-beta": "oauth-2025-04-20",
            "User-Agent": agent,
          },
          signal: controller.signal,
        });

      // Anthropic's private usage endpoint may reject the optional reset inventory query.
      let response = await request(`${ENDPOINT}?cedar_ember=1`, "claude-cli/2.1.0 (external, cli)");
      if (response.status === 400 || response.status === 403) {
        response = await request(ENDPOINT, "claude-code/2.1.0");
      }
      if (response.status === 401)
        return makeUnavailableSnapshot("claude", "AUTH_REQUIRED", "unauthenticated");
      if (response.status === 429) return makeUnavailableSnapshot("claude", "RATE_LIMITED");
      if (response.status !== 200) return makeUnavailableSnapshot("claude", "HTTP_ERROR");
      const content = await readBoundedResponse(response);
      try {
        return parseClaudeOAuthUsage(JSON.parse(content));
      } catch {
        return makeUnavailableSnapshot("claude", "PROTOCOL_ERROR");
      }
    } catch (error) {
      return makeUnavailableSnapshot(
        "claude",
        controller.signal.aborted
          ? "TIMEOUT"
          : error instanceof Error && error.message === "RESPONSE_TOO_LARGE"
            ? "OUTPUT_TOO_LARGE"
            : "NETWORK_ERROR",
      );
    } finally {
      clearTimeout(timer);
    }
  });
}
