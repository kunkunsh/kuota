import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { QuotaSnapshot } from "@kuota/core";
import type { QuotaProvider } from "@kuota/providers";
import { runCli, type CliOutput } from "./commands.js";

let dir: string;
let nowMs: number;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kuota-cli-"));
  nowMs = Date.parse("2026-11-04T12:00:00.000Z");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function sink() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const output: CliOutput = {
    writeStdout: (v) => void stdout.push(v),
    writeStderr: (v) => void stderr.push(v),
  };
  return { output, stdout, stderr };
}

function claude(used: number, over: Partial<QuotaSnapshot> = {}): QuotaProvider {
  return {
    id: "claude",
    label: "Claude",
    read: () =>
      Effect.succeed({
        provider: "claude" as const,
        status: "ok" as const,
        fetchedAt: new Date(nowMs).toISOString(),
        source: "claude-oauth-usage",
        windows: [
          {
            windowId: "weekly.all",
            usedPercent: used,
            remainingPercent: 100 - used,
            resetAt: "2026-11-08T00:00:00.000Z",
          },
        ],
        errorCode: null,
        ...over,
      }),
  };
}

const run = (args: string[], providers: QuotaProvider[] = []) => {
  const s = sink();
  return runCli(args, s.output, providers, undefined, {
    directory: dir,
    now: () => new Date(nowMs),
    deviceId: "test-device",
  }).then((code) => {
    let json: any = null;
    try {
      json = s.stdout[0] ? JSON.parse(s.stdout[0]) : null;
    } catch {
      json = null;
    }
    return { code, ...s, json };
  });
};

describe("kuota collect", () => {
  it("requires --once", async () => {
    const r = await run(["collect", "--json"], [claude(10)]);
    expect(r.code).toBe(2);
    expect(r.json.errors[0].code).toBe("ONCE_REQUIRED");
  });

  it("appends normalized events and is idempotent for a repeated snapshot", async () => {
    const first = await run(["collect", "--once", "--json", "--provider", "claude"], [claude(10)]);
    expect(first.code).toBe(0);
    expect(first.stdout).toHaveLength(1);
    expect(first.json.schemaVersion).toBe(1);
    expect(first.json.collected).toEqual([
      { provider: "claude", status: "ok", written: 1, duplicates: 0 },
    ]);
    const again = await run(["collect", "--once", "--json", "--provider", "claude"], [claude(10)]);
    expect(again.json.collected[0]).toMatchObject({ written: 0, duplicates: 1 });
    const files = (await readdir(dir)).filter((f) => f.endsWith(".jsonl"));
    expect(files).toEqual(["events-2026-11-04.jsonl"]);
    const text = await readFile(join(dir, files[0]!), "utf8");
    expect(text).not.toMatch(/token|secret|@/i);
  });

  it("records provider failures as sanitized events, not zero usage", async () => {
    const r = await run(
      ["collect", "--once", "--json", "--provider", "claude"],
      [claude(0, { status: "unauthenticated", windows: [], errorCode: "AUTH_REQUIRED" })],
    );
    expect(r.code).toBe(0);
    expect(r.json.collected[0]).toMatchObject({ status: "unauthenticated", written: 1 });
    const h = await run(["history", "--json", "--provider", "claude"]);
    expect(h.json.events[0]).toMatchObject({
      kind: "quota_unavailable",
      usedPercent: null,
      state: "unauthenticated",
    });
  });

  it("rejects unknown providers with exit 2", async () => {
    const r = await run(["collect", "--once", "--json", "--provider", "nope"], []);
    expect(r.code).toBe(2);
    expect(r.json.errors[0].code).toBe("UNKNOWN_PROVIDER");
  });
});

describe("kuota history", () => {
  it("returns events filtered by range, provider and window", async () => {
    await run(["collect", "--once", "--json"], [claude(10)]);
    nowMs += 3_600_000;
    await run(["collect", "--once", "--json"], [claude(12)]);
    const all = await run(["history", "--json", "--provider", "claude"]);
    expect(all.json.schemaVersion).toBe(1);
    expect(all.json.events.map((e: { usedPercent: number }) => e.usedPercent)).toEqual([10, 12]);
    expect(all.json.invalidLines).toBe(0);
    const narrow = await run([
      "history",
      "--json",
      "--from",
      "2026-11-04T12:30:00Z",
      "--to",
      "2026-11-05T00:00:00Z",
    ]);
    expect(narrow.json.events).toHaveLength(1);
    const none = await run(["history", "--json", "--window", "session.5h"]);
    expect(none.json.events).toEqual([]);
  });

  it("rejects invalid dates and providers with exit 2", async () => {
    expect((await run(["history", "--json", "--from", "garbage"])).code).toBe(2);
    expect((await run(["history", "--json", "--provider", "x"])).json.errors[0].code).toBe(
      "UNKNOWN_PROVIDER",
    );
  });
});

describe("kuota forecast", () => {
  it("is insufficient with no history and honest with history", async () => {
    const empty = await run(["forecast", "--json", "--provider", "claude"]);
    expect(empty.code).toBe(0);
    expect(empty.json.forecasts).toEqual([]);
    for (let i = 0; i < 12; i++) {
      await run(["collect", "--once", "--json"], [claude(10 + i * 2)]);
      nowMs += 3_600_000;
    }
    const f = await run(["forecast", "--json", "--provider", "claude", "--window", "weekly.all"]);
    expect(f.json.schemaVersion).toBe(1);
    expect(f.json.forecasts).toHaveLength(1);
    expect(f.json.forecasts[0]).toMatchObject({
      provider: "claude",
      windowId: "weekly.all",
      sampleCount: 12,
      mode: "all-window",
    });
    expect(f.json.forecasts[0].slopePercentPerHour).toBeCloseTo(2, 1);
    expect(f.json.forecasts[0].exhaustedAt).not.toBeNull();
    const recent = await run(["forecast", "--json", "--mode", "recent-activity"]);
    expect(recent.json.forecasts[0].mode).toBe("recent-activity");
    expect((await run(["forecast", "--json", "--mode", "bogus"])).code).toBe(2);
  });
});

describe("kuota pace", () => {
  it("reports ideal pace from the live window and null with a reason when unknown", async () => {
    const r = await run(["pace", "--json", "--provider", "claude"], [claude(50)]);
    expect(r.json.schemaVersion).toBe(1);
    const row = r.json.pace[0];
    expect(row).toMatchObject({ provider: "claude", windowId: "weekly.all", semantics: "fixed" });
    // 2026-11-01T00:00Z .. 11-08T00:00Z, now 11-04T12:00Z => 50% elapsed
    expect(row.pace.idealUsedPercent).toBeCloseTo(50, 3);
    expect(row.pace.quality).toBe("inferred");
    const unknown = await run(
      ["pace", "--json"],
      [
        {
          id: "antigravity",
          label: "agy",
          read: () =>
            Effect.succeed({
              provider: "antigravity" as const,
              status: "ok" as const,
              fetchedAt: new Date(nowMs).toISOString(),
              source: "agy",
              windows: [
                { windowId: "gemini.quota", usedPercent: 5, remainingPercent: 95, resetAt: null },
              ],
              errorCode: null,
            }),
        },
      ],
    );
    const agy = unknown.json.pace.find((p: { provider: string }) => p.provider === "antigravity");
    expect(agy.pace).toBeNull();
    expect(agy.reason).toBe("WINDOW_NOT_PROVEN_FIXED");
  });
});

describe("kuota snapshot and snapshots", () => {
  it("kuota snapshot returns live snapshot with inspection details", async () => {
    const r = await run(
      ["snapshot", "--provider", "claude", "--inspect", "--json"],
      [claude(45)],
    );
    expect(r.code).toBe(0);
    expect(r.json.schemaVersion).toBe(1);
    expect(r.json.inspect).toBe(true);
    expect(r.json.snapshots.length).toBe(1);
    expect(r.json.snapshots[0].provider).toBe("claude");
    expect(r.json.snapshots[0].windows[0].usedPercent).toBe(45);

    const text = await run(["snapshot", "--provider", "claude", "--inspect"], [claude(45)]);
    expect(text.code).toBe(0);
    expect(text.stdout[0]).toContain("Provider: claude [ok]");
    expect(text.stdout[0]).toContain("[inspect] semantics:");
  });

  it("kuota snapshots queries historical recorded snapshots from journal", async () => {
    // Collect a snapshot first
    await run(["collect", "--once", "--provider", "claude", "--json"], [claude(55)]);

    const r = await run(["snapshots", "--provider", "claude", "--json"], []);
    expect(r.code).toBe(0);
    expect(r.json.schemaVersion).toBe(1);
    expect(r.json.snapshots.length).toBeGreaterThan(0);
    expect(r.json.snapshots[0].provider).toBe("claude");

    const text = await run(["snapshots", "--provider", "claude"], []);
    expect(text.code).toBe(0);
    expect(text.stdout[0]).toContain("RECORDED AT (UTC)");
    expect(text.stdout[0]).toContain("claude");
  });
});

describe("status --json stays schemaVersion 1", () => {
  it("is unchanged by history features", async () => {
    const r = await run(["status", "--json", "--provider", "claude"], [claude(10)]);
    expect(Object.keys(r.json).sort()).toEqual([
      "errors",
      "generatedAt",
      "providers",
      "schemaVersion",
    ]);
    expect(r.json.schemaVersion).toBe(1);
  });
});
