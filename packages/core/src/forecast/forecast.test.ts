import { describe, expect, it } from "vitest";
import type { QuotaHistoryEventV1 } from "../history/schema.js";
import { detectEpochs, forecastQuota, buildForecastV1 } from "./forecast.js";

const H = 3_600_000;
const START = Date.parse("2026-11-01T00:00:00.000Z");
const RESET = new Date(START + 168 * H);

function ev(
  hours: number,
  used: number,
  over: Partial<QuotaHistoryEventV1> = {},
): QuotaHistoryEventV1 {
  const observedAt = new Date(START + hours * H).toISOString();
  return {
    schemaVersion: 1,
    kind: "quota_observed",
    eventId: `e-${hours}-${used}-${over.epochId ?? ""}`,
    observedAt,
    recordedAt: observedAt,
    provider: "claude",
    accountScope: null,
    deviceId: "d",
    windowId: "weekly.all",
    epochId: RESET.toISOString(),
    semantics: "fixed",
    startAt: new Date(START).toISOString(),
    resetAt: RESET.toISOString(),
    usedPercent: used,
    remainingPercent: 100 - used,
    source: "t",
    state: "ok",
    errorCode: null,
    ...over,
  };
}
const at = (h: number) => new Date(START + h * H);
/** Steady usage: 55% at day 3.5, sampled every 4h. */
const steady = () =>
  Array.from({ length: 22 }, (_, i) => ev(i * 4, Math.round((55 / 84) * i * 4 * 100) / 100));

describe("forecastQuota", () => {
  it("0 or 1 sample is insufficient", () => {
    expect(
      forecastQuota({ now: at(1), resetAt: RESET, observations: [], mode: "all-window" }).quality,
    ).toBe("insufficient");
    const one = forecastQuota({
      now: at(1),
      resetAt: RESET,
      observations: [ev(1, 5)],
      mode: "all-window",
    });
    expect(one.quality).toBe("insufficient");
    expect(one.exhaustedAt).toBeNull();
    expect(one.slopePercentPerHour).toBeNull();
  });

  it("projects exhaustion ~15h before reset for 55% at day 3.5", () => {
    const r = forecastQuota({
      now: at(84),
      resetAt: RESET,
      observations: steady(),
      mode: "all-window",
    });
    expect(r.slopePercentPerHour).toBeCloseTo(55 / 84, 2);
    const hoursBeforeReset = (RESET.getTime() - Date.parse(r.exhaustedAt!)) / H;
    expect(hoursBeforeReset).toBeGreaterThan(14);
    expect(hoursBeforeReset).toBeLessThan(16);
    expect(r.projectedUsedAtResetPercent).toBe(100);
    expect(r.quality).toBe("high");
    expect(r.sampleCount).toBe(22);
    expect(r.observedSpanHours).toBe(84);
  });

  it("on-pace usage gives no false exhaustion timestamp", () => {
    const obs = Array.from({ length: 22 }, (_, i) => ev(i * 4, i * 4 * 0.3));
    const r = forecastQuota({ now: at(84), resetAt: RESET, observations: obs, mode: "all-window" });
    expect(r.exhaustedAt).toBeNull();
    expect(r.reasons).toContain("ON_PACE");
    expect(r.projectedUsedAtResetPercent).toBeCloseTo(25.2 + 0.3 * 84, 0);
  });

  it("a 1h burst is low or insufficient confidence, never high", () => {
    const r = forecastQuota({
      now: at(1),
      resetAt: RESET,
      observations: [ev(0, 0), ev(0.5, 9), ev(1, 18)],
      mode: "all-window",
    });
    expect(["insufficient", "low"]).toContain(r.quality);
  });

  it("rolling windows are unsupported", () => {
    const obs = steady().map((e) => ({ ...e, semantics: "rolling" as const }));
    const r = forecastQuota({ now: at(84), resetAt: RESET, observations: obs, mode: "all-window" });
    expect(r.quality).toBe("unsupported");
    expect(r.exhaustedAt).toBeNull();
    expect(r.reasons).toContain("ROLLING_WINDOW_UNMODELED");
  });

  it("unknown semantics are unsupported with a distinct reason", () => {
    const obs = steady().map((e) => ({ ...e, semantics: "unknown" as const }));
    const r = forecastQuota({ now: at(84), resetAt: RESET, observations: obs, mode: "all-window" });
    expect(r.quality).toBe("unsupported");
    expect(r.reasons).toContain("WINDOW_SEMANTICS_UNKNOWN");
  });

  it("two days with several changes is medium", () => {
    const obs = Array.from({ length: 9 }, (_, i) => ev(i * 6, i * 4));
    const r = forecastQuota({ now: at(48), resetAt: RESET, observations: obs, mode: "all-window" });
    expect(r.quality).toBe("medium");
  });

  it("under 10% used caps confidence at low", () => {
    const obs = Array.from({ length: 22 }, (_, i) => ev(i * 4, i * 0.1));
    const r = forecastQuota({ now: at(84), resetAt: RESET, observations: obs, mode: "all-window" });
    expect(r.quality).toBe("low");
  });

  it("zero slope is stable, not infinite quota", () => {
    const obs = [ev(0, 10), ev(10, 10), ev(20, 10), ev(30, 10)];
    const r = forecastQuota({ now: at(30), resetAt: RESET, observations: obs, mode: "all-window" });
    expect(r.exhaustedAt).toBeNull();
    expect(r.slopePercentPerHour).toBe(0);
    expect(r.reasons).toContain("STABLE_AT_CURRENT_ACTIVITY");
  });

  it("ignores duplicate observedAt", () => {
    const obs = [...steady(), ev(8, 99, { eventId: "dup" })];
    const r = forecastQuota({ now: at(84), resetAt: RESET, observations: obs, mode: "all-window" });
    expect(r.sampleCount).toBe(22);
  });

  it("a reset crossing breaks the epoch: only the latest epoch is used", () => {
    const nextReset = new Date(RESET.getTime() + 168 * H).toISOString();
    const old = [ev(0, 40), ev(40, 80), ev(80, 95)];
    const fresh = [150, 160, 170, 180, 190].map((h, i) =>
      ev(h, i * 2, { epochId: nextReset, resetAt: nextReset }),
    );
    const r = forecastQuota({
      now: at(190),
      resetAt: new Date(nextReset),
      observations: [...old, ...fresh],
      mode: "all-window",
    });
    expect(r.sampleCount).toBe(5);
    expect(r.reasons).toContain("EPOCH_RESET_DETECTED");
    expect(r.slopePercentPerHour).toBeCloseTo(0.2, 3);
  });

  it("a usage decrease inside one epoch id splits the segment (credit / unannounced reset)", () => {
    const obs = [ev(0, 50), ev(10, 60), ev(20, 5), ev(30, 8), ev(40, 11)];
    const r = forecastQuota({ now: at(40), resetAt: RESET, observations: obs, mode: "all-window" });
    expect(r.sampleCount).toBe(3);
    expect(r.reasons).toContain("USAGE_DECREASE_SPLIT");
    expect(r.slopePercentPerHour).toBeCloseTo(0.3, 3);
  });

  it("out-of-order input is sorted and error/unavailable events are ignored", () => {
    const shuffled = [...steady()].reverse();
    const junk = ev(85, 0, { kind: "quota_unavailable", usedPercent: null, state: "error" });
    const r = forecastQuota({
      now: at(84),
      resetAt: RESET,
      observations: [...shuffled, junk],
      mode: "all-window",
    });
    expect(r.sampleCount).toBe(22);
    expect(r.slopePercentPerHour).toBeCloseTo(55 / 84, 2);
  });

  it("stale input and old latest sample lower quality with reasons", () => {
    const stale = steady().map((e) => ({ ...e, state: "stale" as const }));
    const r = forecastQuota({
      now: at(84),
      resetAt: RESET,
      observations: stale,
      mode: "all-window",
    });
    expect(r.reasons).toContain("STALE_INPUT");
    expect(r.quality).toBe("medium");
    const old = forecastQuota({
      now: at(120),
      resetAt: RESET,
      observations: steady(),
      mode: "all-window",
    });
    expect(old.reasons).toContain("LATEST_SAMPLE_OLD");
  });

  it("recent-activity mode uses the last 24h capped-weight median slope", () => {
    const obs = [
      ev(0, 0),
      ev(48, 10),
      ev(52, 10),
      ev(56, 10),
      ev(60, 12),
      ev(64, 14),
      ev(68, 16),
      ev(72, 18),
    ];
    const r = forecastQuota({
      now: at(72),
      resetAt: RESET,
      observations: obs,
      mode: "recent-activity",
    });
    expect(r.slopePercentPerHour).toBeCloseTo(0.5, 2);
    expect(r.sampleCount).toBeLessThanOrEqual(7);
  });

  it("already exhausted reports the observation time", () => {
    const r = forecastQuota({
      now: at(50),
      resetAt: RESET,
      observations: [ev(0, 90), ev(25, 98), ev(50, 100)],
      mode: "all-window",
    });
    expect(r.exhaustedAt).toBe(at(50).toISOString());
    expect(r.reasons).toContain("ALREADY_EXHAUSTED");
  });
});

describe("detectEpochs", () => {
  it("groups by reset boundary with jitter tolerance", () => {
    const jitter = new Date(RESET.getTime() + 2 * 60_000).toISOString();
    const next = new Date(RESET.getTime() + 168 * H).toISOString();
    const segments = detectEpochs([
      ev(1, 1),
      ev(2, 2, { resetAt: jitter, epochId: jitter }),
      ev(200, 3, { epochId: next, resetAt: next }),
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]!.events).toHaveLength(2);
    expect(segments[1]!.reason).toBe("EPOCH_RESET_DETECTED");
  });
});

describe("buildForecastV1", () => {
  it("wraps results in the versioned contract with ideal pace and no secrets", () => {
    const f = buildForecastV1({
      now: at(84),
      provider: "claude",
      windowId: "weekly.all",
      observations: steady(),
      mode: "all-window",
    });
    expect(f.schemaVersion).toBe(1);
    expect(f.computedAt).toBe(at(84).toISOString());
    expect(f.idealUsedPercent).toBeCloseTo(50, 3);
    expect(f.currentUsedPercent).toBe(55);
    expect(f.quality).toBe("high");
    expect(f.expectedTimeToLimitHours).toBeGreaterThan(60);
    expect(Object.keys(f)).not.toContain("accountScope");
  });

  it("returns insufficient with null current value when there is no data", () => {
    const f = buildForecastV1({
      now: at(1),
      provider: "claude",
      windowId: "weekly.all",
      observations: [],
      mode: "all-window",
    });
    expect(f.quality).toBe("insufficient");
    expect(f.currentUsedPercent).toBeNull();
    expect(f.idealUsedPercent).toBeNull();
  });
});
