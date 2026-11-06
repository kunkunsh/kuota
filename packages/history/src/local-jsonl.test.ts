import { mkdtemp, readFile, readdir, writeFile, rm, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { historyEventsFromSnapshot, type QuotaHistoryEventV1 } from "@kuota/core";
import { createLocalJsonlJournal } from "./local-jsonl.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kuota-journal-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function event(observedAt: string, used: number, windowId = "weekly.all"): QuotaHistoryEventV1 {
  return historyEventsFromSnapshot(
    {
      provider: "claude",
      status: "ok",
      fetchedAt: observedAt,
      source: "t",
      windows: [
        {
          windowId,
          usedPercent: used,
          remainingPercent: 100 - used,
          resetAt: "2026-11-12T00:00:00.000Z",
        },
      ],
      errorCode: null,
    },
    { deviceId: "d", accountScope: null, recordedAt: observedAt },
  )[0]!;
}

const collect = async (it: AsyncIterable<QuotaHistoryEventV1>) => {
  const out: QuotaHistoryEventV1[] = [];
  for await (const e of it) out.push(e);
  return out;
};

describe("local JSONL journal", () => {
  it("creates the directory, appends, and rereads events", async () => {
    const journal = createLocalJsonlJournal({ directory: join(dir, "nested", "journal") });
    const a = event("2026-11-06T01:00:00.000Z", 10);
    const b = event("2026-11-06T02:00:00.000Z", 12);
    expect(await journal.append([a, b])).toEqual({ written: 2, duplicates: 0 });
    const read = await collect(
      journal.read({ from: "2026-11-06T00:00:00Z", to: "2026-11-07T00:00:00Z" }),
    );
    expect(read).toEqual([a, b]);
  });

  it("is idempotent for repeated event ids, within a batch and across restarts", async () => {
    const a = event("2026-11-06T01:00:00.000Z", 10);
    const first = createLocalJsonlJournal({ directory: dir });
    expect(await first.append([a, a])).toEqual({ written: 1, duplicates: 1 });
    const restarted = createLocalJsonlJournal({ directory: dir });
    expect(await restarted.append([a])).toEqual({ written: 0, duplicates: 1 });
    expect(
      (await readFile(join(dir, "events-2026-11-06.jsonl"), "utf8")).trim().split("\n"),
    ).toHaveLength(1);
  });

  it("concurrent appends keep complete newline-terminated records", async () => {
    const journal = createLocalJsonlJournal({ directory: dir });
    const other = createLocalJsonlJournal({ directory: dir });
    const events = Array.from({ length: 200 }, (_, i) =>
      event(
        `2026-11-06T${String(i % 24).padStart(2, "0")}:${String(Math.floor(i / 24)).padStart(2, "0")}:00.000Z`,
        i % 100,
      ),
    );
    await Promise.all(events.map((e, i) => (i % 2 ? journal : other).append([e])));
    const text = await readFile(join(dir, "events-2026-11-06.jsonl"), "utf8");
    expect(text.endsWith("\n")).toBe(true);
    const lines = text.trim().split("\n");
    expect(lines).toHaveLength(200);
    for (const line of lines) JSON.parse(line);
  });

  it("recognises a truncated trailing line, does not trust it, and repairs non-destructively", async () => {
    const journal = createLocalJsonlJournal({ directory: dir });
    const a = event("2026-11-06T01:00:00.000Z", 10);
    await journal.append([a]);
    await appendFile(join(dir, "events-2026-11-06.jsonl"), '{"schemaVersion":1,"kind":"quota_obs');
    const result = await journal.readAll({
      from: "2026-11-06T00:00:00Z",
      to: "2026-11-07T00:00:00Z",
    });
    expect(result.events).toEqual([a]);
    expect(result.invalidLines).toBe(1);
    const b = event("2026-11-06T02:00:00.000Z", 11);
    await createLocalJsonlJournal({ directory: dir }).append([b]);
    const after = await journal.readAll({
      from: "2026-11-06T00:00:00Z",
      to: "2026-11-07T00:00:00Z",
    });
    expect(after.events).toEqual([a, b]);
    expect(after.invalidLines).toBe(1);
    expect((await readFile(join(dir, "events-2026-11-06.jsonl"), "utf8")).endsWith("\n")).toBe(
      true,
    );
  });

  it("counts and skips schema-invalid and secret-bearing lines", async () => {
    const journal = createLocalJsonlJournal({ directory: dir });
    const a = event("2026-11-06T01:00:00.000Z", 10);
    await journal.append([a]);
    await appendFile(
      join(dir, "events-2026-11-06.jsonl"),
      JSON.stringify({ ...a, eventId: "x", accessToken: "sk-secret" }) + "\n" + "not json\n",
    );
    const result = await journal.readAll({
      from: "2026-11-06T00:00:00Z",
      to: "2026-11-07T00:00:00Z",
    });
    expect(result.events).toEqual([a]);
    expect(result.invalidLines).toBe(2);
  });

  it("partitions by UTC date and filters by from/to, provider and window", async () => {
    const journal = createLocalJsonlJournal({ directory: dir });
    await journal.append([
      event("2026-11-05T23:30:00.000Z", 1),
      event("2026-11-06T00:30:00.000Z", 2),
      event("2026-11-06T05:00:00.000Z", 3, "session.5h"),
      event("2026-11-07T00:30:00.000Z", 4),
    ]);
    expect((await readdir(dir)).filter((f) => f.endsWith(".jsonl")).sort()).toEqual([
      "events-2026-11-05.jsonl",
      "events-2026-11-06.jsonl",
      "events-2026-11-07.jsonl",
    ]);
    const day = await collect(
      journal.read({ from: "2026-11-06T00:00:00Z", to: "2026-11-06T23:59:59Z" }),
    );
    expect(day.map((e) => e.usedPercent)).toEqual([2, 3]);
    const win = await collect(
      journal.read({
        from: "2026-11-05T00:00:00Z",
        to: "2026-11-08T00:00:00Z",
        windowId: "session.5h",
      }),
    );
    expect(win.map((e) => e.usedPercent)).toEqual([3]);
    const none = await collect(
      journal.read({ from: "2026-11-05T00:00:00Z", to: "2026-11-08T00:00:00Z", provider: "codex" }),
    );
    expect(none).toEqual([]);
  });

  it("rotates oversized partitions yet keeps dedup across parts", async () => {
    const journal = createLocalJsonlJournal({ directory: dir, maxFileBytes: 600 });
    const events = Array.from({ length: 6 }, (_, i) => event(`2026-11-06T0${i}:00:00.000Z`, i + 1));
    await journal.append(events);
    expect((await readdir(dir)).filter((f) => f.endsWith(".jsonl")).length).toBeGreaterThan(1);
    expect(await journal.append(events)).toEqual({ written: 0, duplicates: 6 });
    const all = await journal.readAll({ from: "2026-11-06T00:00:00Z", to: "2026-11-07T00:00:00Z" });
    expect(all.events).toHaveLength(6);
  });

  it("applies retention by whole UTC-day partitions", async () => {
    const journal = createLocalJsonlJournal({ directory: dir, retentionDays: 2 });
    await journal.append([
      event("2026-10-01T00:30:00.000Z", 1),
      event("2026-11-05T00:30:00.000Z", 2),
      event("2026-11-06T00:30:00.000Z", 3),
    ]);
    const removed = await journal.applyRetention(new Date("2026-11-06T12:00:00Z"));
    expect(removed).toBe(1);
    expect((await readdir(dir)).filter((f) => f.endsWith(".jsonl")).sort()).toEqual([
      "events-2026-11-05.jsonl",
      "events-2026-11-06.jsonl",
    ]);
  });

  it("stress: 1000 events survive a restart", async () => {
    const journal = createLocalJsonlJournal({ directory: dir, fsync: false });
    const events = Array.from({ length: 1000 }, (_, i) =>
      event(
        `2026-11-06T${String(Math.floor(i / 60) % 24).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00.000Z`,
        (i % 99) + 1,
      ),
    );
    await journal.append(events);
    const restarted = createLocalJsonlJournal({ directory: dir });
    expect(await restarted.append(events)).toEqual({ written: 0, duplicates: 1000 });
    expect(
      (await restarted.readAll({ from: "2026-11-06T00:00:00Z", to: "2026-11-07T00:00:00Z" }))
        .events,
    ).toHaveLength(1000);
  });

  it("clears a stale lock left by a crashed writer", async () => {
    await writeFile(join(dir, ".lock"), "99999");
    const old = new Date(Date.now() - 120_000);
    const { utimes } = await import("node:fs/promises");
    await utimes(join(dir, ".lock"), old, old);
    const journal = createLocalJsonlJournal({ directory: dir, lockStaleMs: 30_000 });
    expect(await journal.append([event("2026-11-06T01:00:00.000Z", 5)])).toEqual({
      written: 1,
      duplicates: 0,
    });
  });

  it("rejects invalid events instead of writing them", async () => {
    const journal = createLocalJsonlJournal({ directory: dir });
    const bad = {
      ...event("2026-11-06T01:00:00.000Z", 5),
      usedPercent: 500,
    } as QuotaHistoryEventV1;
    await expect(journal.append([bad])).rejects.toThrow();
  });
});
