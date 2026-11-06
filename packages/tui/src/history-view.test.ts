import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { historyEventsFromSnapshot } from "@kuota/core";
import { createLocalJsonlJournal } from "@kuota/history";
import { loadHistoryView } from "./history-view.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kuota-tui-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadHistoryView", () => {
  it("returns empty data for a missing journal without creating it", async () => {
    const view = await loadHistoryView(join(dir, "none"), new Date("2026-11-04T12:00:00Z"));
    expect(view).toEqual({ series: {}, forecasts: [] });
  });

  it("builds per-window series and forecasts from the journal", async () => {
    const journal = createLocalJsonlJournal({ directory: dir });
    const start = Date.parse("2026-11-04T00:00:00Z");
    for (let i = 0; i < 8; i++) {
      const at = new Date(start + i * 3_600_000).toISOString();
      await journal.append(
        historyEventsFromSnapshot(
          {
            provider: "claude",
            status: "ok",
            fetchedAt: at,
            source: "t",
            windows: [
              {
                windowId: "weekly.all",
                usedPercent: i * 2,
                remainingPercent: 100 - i * 2,
                resetAt: "2026-11-08T00:00:00.000Z",
              },
            ],
            errorCode: null,
          },
          { deviceId: "d", accountScope: null, recordedAt: at },
        ),
      );
    }
    const view = await loadHistoryView(dir, new Date("2026-11-04T08:00:00Z"));
    expect(view.series["claude/weekly.all"]).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(view.forecasts).toHaveLength(1);
    expect(view.forecasts[0]!.sampleCount).toBe(8);
  });
});
