import { describe, expect, it } from "vitest";
import { decodeHistoryEvent, historyEventsFromSnapshot, windowProfile } from "./schema.js";
import type { QuotaSnapshot } from "../types.js";

const FETCHED = "2026-11-06T01:00:00.000Z";
const options = {
  deviceId: "dev-1",
  accountScope: null,
  recordedAt: "2026-11-06T01:00:05.000Z",
};
const snap = (over: Partial<QuotaSnapshot> = {}): QuotaSnapshot => ({
  provider: "claude",
  status: "ok",
  fetchedAt: FETCHED,
  source: "claude-oauth-usage",
  windows: [
    {
      windowId: "session.5h",
      usedPercent: 12,
      remainingPercent: 88,
      resetAt: "2026-11-06T04:00:00.000Z",
    },
    {
      windowId: "weekly.all",
      usedPercent: 40,
      remainingPercent: 60,
      resetAt: "2026-11-10T00:00:00.000Z",
    },
  ],
  errorCode: null,
  ...over,
});

describe("windowProfile", () => {
  it("knows fixed cadences and refuses to guess otherwise", () => {
    expect(windowProfile("claude", "session.5h")).toEqual({
      semantics: "fixed",
      durationMs: 18_000_000,
    });
    expect(windowProfile("claude", "weekly.opus").durationMs).toBe(7 * 86_400_000);
    expect(windowProfile("codex", "primary").durationMs).toBe(18_000_000);
    expect(windowProfile("codex", "secondary").durationMs).toBe(7 * 86_400_000);
    expect(windowProfile("antigravity", "gemini.weekly").durationMs).toBe(7 * 86_400_000);
    expect(windowProfile("antigravity", "gemini.quota")).toEqual({
      semantics: "unknown",
      durationMs: null,
    });
  });
});

describe("historyEventsFromSnapshot", () => {
  it("emits one typed event per valid window with shared observedAt", () => {
    const events = historyEventsFromSnapshot(snap(), options);
    expect(events).toHaveLength(2);
    for (const e of events) {
      expect(e.schemaVersion).toBe(1);
      expect(e.kind).toBe("quota_observed");
      expect(e.observedAt).toBe(FETCHED);
      expect(e.recordedAt).toBe(options.recordedAt);
      expect(e.state).toBe("ok");
      expect(decodeHistoryEvent(e)._tag).toBe("Right");
    }
    expect(events[0]!.epochId).toBe("2026-11-06T04:00:00.000Z");
    expect(events[0]!.startAt).toBe("2026-11-05T23:00:00.000Z");
    expect(events[0]!.semantics).toBe("fixed");
  });

  it("skips invalid percentages instead of faking 0", () => {
    const events = historyEventsFromSnapshot(
      snap({
        status: "partial",
        windows: [
          { windowId: "session.5h", usedPercent: null, remainingPercent: null, resetAt: null },
          { windowId: "weekly.all", usedPercent: 140, remainingPercent: null, resetAt: null },
        ],
      }),
      options,
    );
    expect(events.filter((e) => e.kind === "quota_observed")).toHaveLength(0);
  });

  it("null resetAt yields null epoch/start", () => {
    const [e] = historyEventsFromSnapshot(
      snap({
        windows: [{ windowId: "session.5h", usedPercent: 5, remainingPercent: 95, resetAt: null }],
      }),
      options,
    );
    expect(e!.epochId).toBeNull();
    expect(e!.startAt).toBeNull();
  });

  it("unauthenticated produces a sanitized error event, not usage", () => {
    const events = historyEventsFromSnapshot(
      snap({ status: "unauthenticated", windows: [], errorCode: "AUTH_REQUIRED" }),
      options,
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("quota_unavailable");
    expect(events[0]!.state).toBe("unauthenticated");
    expect(events[0]!.errorCode).toBe("AUTH_REQUIRED");
    expect(events[0]!.usedPercent).toBeNull();
  });

  it("unavailable maps to error state; stale marks stale", () => {
    expect(
      historyEventsFromSnapshot(
        snap({ status: "unavailable", windows: [], errorCode: "TIMEOUT" }),
        options,
      )[0]!.state,
    ).toBe("error");
    expect(historyEventsFromSnapshot(snap(), { ...options, stale: true })[0]!.state).toBe("stale");
  });

  it("returns nothing for an invalid fetchedAt", () => {
    expect(historyEventsFromSnapshot(snap({ fetchedAt: "nope" }), options)).toEqual([]);
  });

  it("event ids are stable across retries and distinct across values and accounts", () => {
    const a = historyEventsFromSnapshot(snap(), options);
    const b = historyEventsFromSnapshot(snap(), {
      ...options,
      recordedAt: "2030-01-01T00:00:00.000Z",
    });
    expect(a.map((e) => e.eventId)).toEqual(b.map((e) => e.eventId));
    expect(new Set(a.map((e) => e.eventId)).size).toBe(2);
    const c = historyEventsFromSnapshot(snap(), { ...options, accountScope: "acct-2" });
    expect(c[0]!.eventId).not.toBe(a[0]!.eventId);
  });

  it("strict decode rejects unknown secret-bearing fields and bad values", () => {
    const [e] = historyEventsFromSnapshot(snap(), options);
    expect(decodeHistoryEvent({ ...e, accessToken: "x" })._tag).toBe("Left");
    expect(decodeHistoryEvent({ ...e, usedPercent: Number.NaN })._tag).toBe("Left");
    expect(decodeHistoryEvent({ ...e, usedPercent: 101 })._tag).toBe("Left");
    expect(decodeHistoryEvent({ ...e, observedAt: "garbage" })._tag).toBe("Left");
    expect(decodeHistoryEvent({ ...e, schemaVersion: 2 })._tag).toBe("Left");
  });
});
