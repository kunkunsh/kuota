import { Either, Schema } from "effect";
import { sha256Hex } from "../hash.js";
import type { ProviderId, QuotaSnapshot } from "../types.js";

export type WindowSemantics = "fixed" | "rolling" | "first_use" | "unknown";

const HOUR = 3_600_000;

export interface WindowProfile {
  readonly semantics: WindowSemantics;
  readonly durationMs: number | null;
}

/**
 * Window cadence heuristics, derived from window ids the adapters emit. Only cadences named in
 * the id (5h / weekly / daily) are trusted; everything else stays `unknown` rather than guessed.
 * Codex `primary` / `secondary` follow the documented 5h / weekly convention of its app-server.
 */
export function windowProfile(provider: ProviderId, windowId: string): WindowProfile {
  if (provider === "codex") {
    if (windowId === "primary") return { semantics: "fixed", durationMs: 5 * HOUR };
    if (windowId === "secondary") return { semantics: "fixed", durationMs: 168 * HOUR };
  }
  const id = windowId.toLowerCase();
  const has = (re: RegExp) => re.test(id);
  if (has(/(^|[.:_-])(5h|five-hour)([.:_-]|$)/))
    return { semantics: "fixed", durationMs: 5 * HOUR };
  if (has(/(^|[.:_-])(weekly|7d|seven-day)([.:_-]|$)/))
    return { semantics: "fixed", durationMs: 168 * HOUR };
  if (has(/(^|[.:_-])(daily|24h)([.:_-]|$)/)) return { semantics: "fixed", durationMs: 24 * HOUR };
  return { semantics: "unknown", durationMs: null };
}

const IsoDate = Schema.String.pipe(
  Schema.filter((value) => Number.isFinite(Date.parse(value)) || "must be an ISO timestamp"),
);
const Percent = Schema.Number.pipe(
  Schema.filter((value) => (Number.isFinite(value) && value >= 0 && value <= 100) || "0..100"),
);

export const QuotaHistoryEventV1Schema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  kind: Schema.Literal("quota_observed", "quota_unavailable", "usage_observed"),
  eventId: Schema.String,
  observedAt: IsoDate,
  recordedAt: IsoDate,
  provider: Schema.String,
  accountScope: Schema.NullOr(Schema.String),
  deviceId: Schema.String,
  windowId: Schema.String,
  epochId: Schema.NullOr(Schema.String),
  semantics: Schema.Literal("fixed", "rolling", "first_use", "unknown"),
  startAt: Schema.NullOr(IsoDate),
  resetAt: Schema.NullOr(IsoDate),
  usedPercent: Schema.NullOr(Percent),
  remainingPercent: Schema.NullOr(Percent),
  source: Schema.String,
  state: Schema.Literal("ok", "partial", "stale", "error", "unauthenticated"),
  errorCode: Schema.NullOr(Schema.String),
  usage: Schema.optional(
    Schema.Struct({
      inputTokens: Schema.optional(Schema.Number),
      outputTokens: Schema.optional(Schema.Number),
      cacheReadTokens: Schema.optional(Schema.Number),
      cacheWriteTokens: Schema.optional(Schema.Number),
      model: Schema.optional(Schema.String),
      estimatedUsd: Schema.optional(Schema.Number),
    }),
  ),
});
export type QuotaHistoryEventV1 = Schema.Schema.Type<typeof QuotaHistoryEventV1Schema>;

const decode = Schema.decodeUnknownEither(QuotaHistoryEventV1Schema, { onExcessProperty: "error" });

/** Strict decode: unknown (possibly secret-bearing) fields are rejected, not silently kept. */
export function decodeHistoryEvent(input: unknown): Either.Either<QuotaHistoryEventV1, unknown> {
  return decode(input);
}

export interface HistoryEventOptions {
  deviceId: string;
  accountScope: string | null;
  recordedAt: string;
  /** Mark observations that came from a stale cache rather than a live probe. */
  stale?: boolean;
  semanticsForWindow?: (id: string) => WindowSemantics;
  startForWindow?: (id: string) => string | null;
}

const validPercent = (v: number | null): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;

const minuteIso = (ms: number): string => new Date(Math.round(ms / 60_000) * 60_000).toISOString();

function makeId(parts: readonly (string | number | null)[]): string {
  return sha256Hex(parts.map((part) => (part === null ? "\u0000" : String(part))).join("\u001f"));
}

/** Pure normalization: one event per measurable window, or one sanitized unavailable event. */
export function historyEventsFromSnapshot(
  snapshot: QuotaSnapshot,
  options: HistoryEventOptions,
): readonly QuotaHistoryEventV1[] {
  const observedMs = Date.parse(snapshot.fetchedAt);
  if (!Number.isFinite(observedMs)) return [];
  const observedAt = new Date(observedMs).toISOString();
  const base = {
    schemaVersion: 1 as const,
    observedAt,
    recordedAt: options.recordedAt,
    provider: snapshot.provider,
    accountScope: options.accountScope,
    deviceId: options.deviceId,
    source: snapshot.source,
  };

  const measurable = snapshot.windows.filter((w) => validPercent(w.usedPercent));
  if (!(snapshot.status === "ok" || snapshot.status === "partial") || measurable.length === 0) {
    const state = snapshot.status === "unauthenticated" ? "unauthenticated" : "error";
    const errorCode = snapshot.errorCode ?? snapshot.status.toUpperCase();
    return [
      {
        ...base,
        kind: "quota_unavailable",
        eventId: makeId([
          "quota_unavailable",
          snapshot.provider,
          options.accountScope,
          options.deviceId,
          observedAt,
          state,
          errorCode,
        ]),
        windowId: "*",
        epochId: null,
        semantics: "unknown",
        startAt: null,
        resetAt: null,
        usedPercent: null,
        remainingPercent: null,
        state,
        errorCode,
      },
    ];
  }

  const state = options.stale ? "stale" : snapshot.status === "partial" ? "partial" : "ok";
  return measurable.map((window) => {
    const profile = windowProfile(snapshot.provider, window.windowId);
    const semantics = options.semanticsForWindow?.(window.windowId) ?? profile.semantics;
    const resetMs = window.resetAt === null ? NaN : Date.parse(window.resetAt);
    const hasReset = Number.isFinite(resetMs);
    const epochId = hasReset ? minuteIso(resetMs) : null;
    const providedStart = options.startForWindow?.(window.windowId) ?? null;
    const startAt =
      providedStart !== null && Number.isFinite(Date.parse(providedStart))
        ? new Date(providedStart).toISOString()
        : hasReset && profile.durationMs !== null
          ? new Date(resetMs - profile.durationMs).toISOString()
          : null;
    const usedPercent = window.usedPercent as number;
    const remaining = validPercent(window.remainingPercent)
      ? window.remainingPercent
      : Math.max(0, Math.min(100, 100 - usedPercent));
    return {
      ...base,
      kind: "quota_observed" as const,
      eventId: makeId([
        "quota_observed",
        snapshot.provider,
        options.accountScope,
        options.deviceId,
        window.windowId,
        epochId,
        observedAt,
        usedPercent,
        state,
      ]),
      windowId: window.windowId,
      epochId,
      semantics,
      startAt,
      resetAt: hasReset ? new Date(resetMs).toISOString() : null,
      usedPercent,
      remainingPercent: remaining,
      state,
      errorCode: snapshot.status === "partial" ? snapshot.errorCode : null,
    };
  });
}
