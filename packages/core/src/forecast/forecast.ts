import { calculatePace } from "../metrics/pace.js";
import type { QuotaHistoryEventV1 } from "../history/schema.js";

export type ForecastQuality = "insufficient" | "low" | "medium" | "high" | "unsupported";
export type ForecastMode = "all-window" | "recent-activity";

export interface ForecastInput {
  now: Date;
  resetAt: Date | null;
  observations: readonly QuotaHistoryEventV1[];
  mode: ForecastMode;
}

export interface ForecastResult {
  slopePercentPerHour: number | null;
  exhaustedAt: string | null;
  projectedUsedAtResetPercent: number | null;
  sampleCount: number;
  observedSpanHours: number;
  quality: ForecastQuality;
  reasons: readonly string[];
}

const H = 3_600_000;
const EPOCH_TOLERANCE_MS = 10 * 60_000;
const DECREASE_TOLERANCE = 0.5;
const GAP_CAP_HOURS = 6;
const RECENT_HOURS = 24;
const STALE_LATEST_MS = 6 * H;
const SLOPE_EPSILON = 1e-6;

const LEVELS = ["low", "medium", "high"] as const;

export interface EpochSegment {
  events: QuotaHistoryEventV1[];
  /** Why this segment started (null for the first). */
  reason: "EPOCH_RESET_DETECTED" | "USAGE_DECREASE_SPLIT" | null;
}

const ms = (iso: string | null): number => (iso === null ? NaN : Date.parse(iso));
const boundary = (e: QuotaHistoryEventV1): number => {
  const reset = ms(e.resetAt);
  return Number.isFinite(reset) ? reset : ms(e.epochId);
};

export function isMeasurable(e: QuotaHistoryEventV1): boolean {
  return (
    e.kind === "quota_observed" &&
    (e.state === "ok" || e.state === "partial" || e.state === "stale") &&
    e.usedPercent !== null &&
    Number.isFinite(e.usedPercent) &&
    Number.isFinite(ms(e.observedAt))
  );
}

/**
 * Reset/epoch detection. A new segment starts when the provider-reported reset boundary moves
 * (beyond jitter tolerance) or when used% drops (credit / unannounced reset). Fixed windows only
 * ever compare points inside one segment.
 */
export function detectEpochs(events: readonly QuotaHistoryEventV1[]): EpochSegment[] {
  const sorted = events
    .filter(isMeasurable)
    .map((e, i) => ({ e, i }))
    .sort((a, b) => ms(a.e.observedAt) - ms(b.e.observedAt) || a.i - b.i)
    .map(({ e }) => e);
  const segments: EpochSegment[] = [];
  let lastTime = NaN;
  for (const event of sorted) {
    const time = ms(event.observedAt);
    if (time === lastTime) continue; // repeated reading of the same source sample
    lastTime = time;
    const current = segments[segments.length - 1];
    const prev = current?.events[current.events.length - 1];
    if (!current || !prev) {
      segments.push({ events: [event], reason: null });
      continue;
    }
    const a = boundary(prev);
    const b = boundary(event);
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > EPOCH_TOLERANCE_MS) {
      segments.push({ events: [event], reason: "EPOCH_RESET_DETECTED" });
    } else if ((event.usedPercent as number) < (prev.usedPercent as number) - DECREASE_TOLERANCE) {
      segments.push({ events: [event], reason: "USAGE_DECREASE_SPLIT" });
    } else current.events.push(event);
  }
  return segments;
}

function weightedMedian(items: readonly { value: number; weight: number }[]): number {
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  let acc = 0;
  for (const item of sorted) {
    acc += item.weight;
    if (acc >= total / 2) return item.value;
  }
  return 0;
}

const unsupported = (reasons: string[]): ForecastResult => ({
  slopePercentPerHour: null,
  exhaustedAt: null,
  projectedUsedAtResetPercent: null,
  sampleCount: 0,
  observedSpanHours: 0,
  quality: "unsupported",
  reasons,
});

export function forecastQuota(input: ForecastInput): ForecastResult {
  const segments = detectEpochs(input.observations);
  const last = segments[segments.length - 1];
  if (!last) {
    return { ...unsupported([]), quality: "insufficient", reasons: ["NO_OBSERVATIONS"] };
  }
  const latest = last.events[last.events.length - 1]!;
  if (latest.semantics === "rolling") return unsupported(["ROLLING_WINDOW_UNMODELED"]);
  if (latest.semantics === "unknown") return unsupported(["WINDOW_SEMANTICS_UNKNOWN"]);

  const reasons: string[] = [];
  if (last.reason) reasons.push(last.reason);

  let samples = last.events;
  const latestMs = ms(latest.observedAt);
  if (input.mode === "recent-activity") {
    samples = samples.filter((e) => ms(e.observedAt) >= latestMs - RECENT_HOURS * H);
  }
  const first = samples[0]!;
  const firstMs = ms(first.observedAt);
  const spanHours = (latestMs - firstMs) / H;
  const used = latest.usedPercent as number;
  const base = { sampleCount: samples.length, observedSpanHours: spanHours };

  if (samples.length < 3 || spanHours < 2) {
    return {
      ...base,
      slopePercentPerHour: null,
      exhaustedAt: used >= 100 ? latest.observedAt : null,
      projectedUsedAtResetPercent: null,
      quality: "insufficient",
      reasons: [...reasons, "INSUFFICIENT_DATA", ...(used >= 100 ? ["ALREADY_EXHAUSTED"] : [])],
    };
  }

  const intervals: { value: number; weight: number }[] = [];
  let changes = 0;
  for (let i = 1; i < samples.length; i++) {
    const dt = (ms(samples[i]!.observedAt) - ms(samples[i - 1]!.observedAt)) / H;
    const du = (samples[i]!.usedPercent as number) - (samples[i - 1]!.usedPercent as number);
    if (dt <= 0 || du < 0) continue;
    if (du > 0) changes++;
    intervals.push({ value: du / dt, weight: Math.min(dt, GAP_CAP_HOURS) });
  }
  const slope =
    input.mode === "all-window"
      ? (used - (first.usedPercent as number)) / spanHours
      : weightedMedian(intervals);

  // Quality heuristics (not calibrated probabilities).
  const positive = intervals.filter((i) => i.value > 0).map((i) => i.value);
  const mean = positive.reduce((a, b) => a + b, 0) / (positive.length || 1);
  const variance = positive.reduce((a, b) => a + (b - mean) ** 2, 0) / (positive.length || 1);
  const lowVariability = mean > 0 && Math.sqrt(variance) / mean < 0.5;
  let level = 0;
  if (spanHours >= 24 && used >= 10) level = 1;
  if (spanHours >= 72 && changes >= 20 && lowVariability && used >= 10) level = 2;
  else if (spanHours >= 24 && changes < 6) level = 0;
  if (samples.some((s) => s.state === "stale")) {
    reasons.push("STALE_INPUT");
    level = Math.max(0, level - 1);
  }
  if (input.now.getTime() - latestMs > STALE_LATEST_MS) {
    reasons.push("LATEST_SAMPLE_OLD");
    level = Math.max(0, level - 1);
  }
  const quality = LEVELS[level]!;

  const resetMs = input.resetAt ? input.resetAt.getTime() : boundary(latest);
  const hasReset = Number.isFinite(resetMs);
  const roundedSlope = Math.max(0, slope);
  let exhaustedAt: string | null = null;
  let projected: number | null = null;

  if (used >= 100) {
    exhaustedAt = latest.observedAt;
    projected = 100;
    reasons.push("ALREADY_EXHAUSTED");
  } else if (roundedSlope <= SLOPE_EPSILON) {
    reasons.push("STABLE_AT_CURRENT_ACTIVITY");
    projected = used;
  } else {
    const exhaustMs = latestMs + ((100 - used) / roundedSlope) * H;
    projected = Math.min(
      100,
      used + roundedSlope * (hasReset ? Math.max(0, resetMs - latestMs) / H : 0),
    );
    if (!hasReset || exhaustMs <= resetMs) {
      exhaustedAt = new Date(exhaustMs).toISOString();
      reasons.push("EXHAUSTION_BEFORE_RESET");
    } else reasons.push("ON_PACE");
    if (!hasReset) projected = null;
  }
  return {
    ...base,
    slopePercentPerHour: roundedSlope,
    exhaustedAt,
    projectedUsedAtResetPercent: projected,
    quality,
    reasons,
  };
}

export interface QuotaForecastV1 {
  schemaVersion: 1;
  provider: string;
  windowId: string;
  computedAt: string;
  currentUsedPercent: number | null;
  idealUsedPercent: number | null;
  observedSpanHours: number;
  sampleCount: number;
  slopePercentPerHour: number | null;
  exhaustedAt: string | null;
  projectedUsedAtResetPercent: number | null;
  expectedTimeToLimitHours: number | null;
  mode: ForecastMode;
  quality: ForecastQuality;
  reasons: string[];
}

/** Account-safe wrapper: only events sharing the newest event's accountScope are considered. */
export function buildForecastV1(input: {
  now: Date;
  provider: string;
  windowId: string;
  observations: readonly QuotaHistoryEventV1[];
  mode: ForecastMode;
}): QuotaForecastV1 {
  const scoped = input.observations
    .filter(
      (e) => e.provider === input.provider && e.windowId === input.windowId && isMeasurable(e),
    )
    .sort((a, b) => ms(a.observedAt) - ms(b.observedAt));
  const newest = scoped[scoped.length - 1];
  const events = newest ? scoped.filter((e) => e.accountScope === newest.accountScope) : [];
  const result = forecastQuota({
    now: input.now,
    resetAt: null,
    observations: events,
    mode: input.mode,
  });
  const latest = events[events.length - 1];
  const pace = latest
    ? calculatePace({
        now: input.now,
        startAt: latest.startAt ? new Date(latest.startAt) : null,
        resetAt: latest.resetAt ? new Date(latest.resetAt) : null,
        usedPercent: latest.usedPercent,
        semantics: latest.semantics,
        startSource: latest.startAt ? "inferred" : "unknown",
      })
    : null;
  return {
    schemaVersion: 1,
    provider: input.provider,
    windowId: input.windowId,
    computedAt: input.now.toISOString(),
    currentUsedPercent: latest ? latest.usedPercent : null,
    idealUsedPercent: pace ? pace.idealUsedPercent : null,
    observedSpanHours: result.observedSpanHours,
    sampleCount: result.sampleCount,
    slopePercentPerHour: result.slopePercentPerHour,
    exhaustedAt: result.exhaustedAt,
    projectedUsedAtResetPercent: result.projectedUsedAtResetPercent,
    expectedTimeToLimitHours: result.exhaustedAt
      ? Math.max(0, (Date.parse(result.exhaustedAt) - input.now.getTime()) / H)
      : null,
    mode: input.mode,
    quality: result.quality,
    reasons: [...result.reasons],
  };
}
