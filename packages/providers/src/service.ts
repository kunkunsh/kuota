import { Effect } from "effect";
import {
  makeObservation,
  makeUnavailableSnapshot,
  type Freshness,
  type ProviderId,
  type QuotaObservation,
  type QuotaSnapshot,
} from "@kuota/core";
import type { QuotaProvider } from "./registry.js";
import { builtInProviders } from "./registry.js";

export type RefreshPolicy = Readonly<{
  successTtlMs: number;
  errorRetryMs: number;
  authRetryMs: number;
  rateLimitCooldownMs: number;
  staleMaxAgeMs: number;
}>;

export interface QuotaService {
  read(
    ids: readonly ProviderId[],
    options?: { force?: boolean },
  ): Effect.Effect<readonly QuotaObservation[]>;
  peek(id: ProviderId): QuotaObservation | null;
  invalidate(id?: ProviderId): void;
}

const COMMON = {
  errorRetryMs: 60_000,
  authRetryMs: 300_000,
  rateLimitCooldownMs: 900_000,
  staleMaxAgeMs: 86_400_000,
};
export const DEFAULT_POLICIES: Readonly<Record<ProviderId, RefreshPolicy>> = {
  codex: { ...COMMON, successTtlMs: 60_000 },
  claude: { ...COMMON, successTtlMs: 900_000 },
  antigravity: { ...COMMON, successTtlMs: 300_000 },
};

interface Slot {
  lastGood: QuotaSnapshot | null;
  lastFailure: QuotaSnapshot | null;
  lastCheckedAtMs: number;
  /** Failure-driven cooldown; ignored by `force`. 0 when no cooldown. */
  nextAttemptAtMs: number;
  inflight: Promise<void> | null;
  generation: number;
}

const emptySlot = (generation: number): Slot => ({
  lastGood: null,
  lastFailure: null,
  lastCheckedAtMs: 0,
  nextAttemptAtMs: 0,
  inflight: null,
  generation,
});

const isMeasurable = (s: QuotaSnapshot) =>
  (s.status === "ok" || s.status === "partial") && s.windows.length > 0;

/**
 * Process-local TTL cache with per-provider singleflight, failure cooldowns and honest
 * stale labelling. Only normalized snapshots are retained.
 */
export function createQuotaService(
  options: {
    providers?: readonly QuotaProvider[];
    now?: () => number;
    policies?: Partial<Record<ProviderId, Partial<RefreshPolicy>>>;
  } = {},
): QuotaService {
  const now = options.now ?? Date.now;
  const providers = new Map(
    (options.providers ?? builtInProviders()).map((provider) => [provider.id, provider]),
  );
  const slots = new Map<ProviderId, Slot>();
  const generations = new Map<ProviderId, number>();
  const policyFor = (id: ProviderId): RefreshPolicy => ({
    ...DEFAULT_POLICIES[id],
    ...options.policies?.[id],
  });
  const slotFor = (id: ProviderId): Slot => {
    let slot = slots.get(id);
    if (!slot) {
      slot = emptySlot(generations.get(id) ?? 0);
      slots.set(id, slot);
    }
    return slot;
  };

  const view = (id: ProviderId, freshProbe: boolean): QuotaObservation | null => {
    const slot = slots.get(id);
    if (!slot) return null;
    const t = now();
    const policy = policyFor(id);
    const good = slot.lastGood;
    const goodMs = good ? Date.parse(good.fetchedAt) : NaN;
    const goodUsable =
      good !== null &&
      !(t - (Number.isFinite(goodMs) ? goodMs : slot.lastCheckedAtMs) > policy.staleMaxAgeMs);
    const nextAttemptAtMs = slot.nextAttemptAtMs > t ? slot.nextAttemptAtMs : null;
    if (good && goodUsable) {
      const failed = slot.lastFailure;
      const freshness: Freshness = failed ? "stale" : freshProbe ? "live" : "cached";
      return makeObservation({
        snapshot: good,
        freshness,
        checkedAtMs: slot.lastCheckedAtMs,
        nowMs: t,
        nextAttemptAtMs,
        latestErrorCode: failed?.errorCode ?? null,
      });
    }
    if (slot.lastFailure) {
      return makeObservation({
        snapshot: slot.lastFailure,
        freshness: freshProbe ? "live" : "cached",
        checkedAtMs: slot.lastCheckedAtMs,
        nowMs: t,
        nextAttemptAtMs,
        latestErrorCode: slot.lastFailure.errorCode,
      });
    }
    return null;
  };

  const probe = (id: ProviderId, provider: QuotaProvider, slot: Slot): Promise<void> => {
    const attemptAt = now();
    const run = Effect.runPromise(
      provider.read().pipe(
        Effect.catchAllCause(() =>
          Effect.succeed({
            ...makeUnavailableSnapshot(id, "PROVIDER_FAILED"),
            fetchedAt: new Date(attemptAt).toISOString(),
          }),
        ),
      ),
    ).catch((): QuotaSnapshot => ({
      ...makeUnavailableSnapshot(id, "PROVIDER_FAILED"),
      fetchedAt: new Date(attemptAt).toISOString(),
    }));
    const settled: Promise<void> = run
      .then((snapshot) => {
        if (slots.get(id) !== slot || slot.generation !== (generations.get(id) ?? 0)) return;
        const policy = policyFor(id);
        const t = now();
        slot.lastCheckedAtMs = attemptAt;
        if (isMeasurable(snapshot)) {
          slot.lastGood = snapshot;
          slot.lastFailure = null;
          slot.nextAttemptAtMs = 0;
          return;
        }
        slot.lastFailure = snapshot;
        if (snapshot.errorCode === "RATE_LIMITED") {
          slot.nextAttemptAtMs = t + policy.rateLimitCooldownMs;
        } else if (
          snapshot.errorCode === "AUTH_REQUIRED" ||
          snapshot.status === "unauthenticated"
        ) {
          // Never keep showing a previous account's quota after auth is lost.
          slot.lastGood = null;
          slot.nextAttemptAtMs = t + policy.authRetryMs;
        } else {
          slot.nextAttemptAtMs = t + policy.errorRetryMs;
        }
      })
      .finally(() => {
        if (slot.inflight === settled) slot.inflight = null;
      });
    slot.inflight = settled;
    return settled;
  };

  const readOne = async (id: ProviderId, force: boolean): Promise<QuotaObservation> => {
    const provider = providers.get(id);
    if (!provider) {
      const t = now();
      return makeObservation({
        snapshot: {
          ...makeUnavailableSnapshot(id, "NOT_REGISTERED", "unsupported"),
          fetchedAt: new Date(t).toISOString(),
        },
        freshness: "live",
        checkedAtMs: t,
        nowMs: t,
        latestErrorCode: "NOT_REGISTERED",
      });
    }
    const slot = slotFor(id);
    if (slot.inflight) {
      await slot.inflight;
      return view(id, true) ?? (await readOne(id, force));
    }
    const t = now();
    const coolingDown = slot.nextAttemptAtMs > t;
    const goodMs = slot.lastGood ? Date.parse(slot.lastGood.fetchedAt) : NaN;
    const fresh =
      slot.lastGood !== null &&
      slot.lastFailure === null &&
      Number.isFinite(goodMs) &&
      t - goodMs < policyFor(id).successTtlMs;
    if (coolingDown || (fresh && !force)) {
      const cached = view(id, false);
      if (cached) return cached;
    }
    await probe(id, provider, slot);
    const result = view(id, true);
    if (result) return result;
    // Invalidated mid-flight: report the probe honestly without caching it.
    const t2 = now();
    return makeObservation({
      snapshot: makeUnavailableSnapshot(id, "INVALIDATED"),
      freshness: "live",
      checkedAtMs: t2,
      nowMs: t2,
      latestErrorCode: "INVALIDATED",
    });
  };

  return {
    read: (ids, opts) =>
      Effect.promise(() => Promise.all(ids.map((id) => readOne(id, opts?.force === true)))),
    peek: (id) => view(id, false),
    invalidate: (id) => {
      for (const target of id ? [id] : (["codex", "claude", "antigravity"] as const)) {
        generations.set(target, (generations.get(target) ?? 0) + 1);
        slots.delete(target);
      }
    },
  };
}
