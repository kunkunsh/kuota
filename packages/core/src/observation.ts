import type { QuotaSnapshot } from "./types.js";

export type Freshness = "live" | "cached" | "stale";

/** Non-breaking wrapper: QuotaSnapshot itself (and status --json schemaVersion 1) is unchanged. */
export interface QuotaObservation {
  readonly snapshot: QuotaSnapshot;
  readonly freshness: Freshness;
  readonly observedAt: string;
  readonly checkedAt: string;
  readonly ageMs: number;
  readonly nextAttemptAt: string | null;
  readonly latestErrorCode: string | null;
}

function iso(ms: number): string {
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date(0).toISOString();
}

/**
 * Pure constructor. If `snapshot.fetchedAt` is not a valid timestamp we fall back to the
 * injected `checkedAtMs` as the observation time, so no NaN / Invalid Date is ever emitted.
 */
export function makeObservation(input: {
  snapshot: QuotaSnapshot;
  freshness: Freshness;
  checkedAtMs: number;
  nowMs: number;
  nextAttemptAtMs?: number | null;
  latestErrorCode?: string | null;
}): QuotaObservation {
  const parsed = Date.parse(input.snapshot.fetchedAt);
  const observedMs = Number.isFinite(parsed) ? parsed : input.checkedAtMs;
  const next = input.nextAttemptAtMs;
  return {
    snapshot: input.snapshot,
    freshness: input.freshness,
    observedAt: iso(observedMs),
    checkedAt: iso(input.checkedAtMs),
    ageMs: Math.max(0, input.nowMs - observedMs),
    nextAttemptAt: next === null || next === undefined || !Number.isFinite(next) ? null : iso(next),
    latestErrorCode: input.latestErrorCode ?? null,
  };
}
