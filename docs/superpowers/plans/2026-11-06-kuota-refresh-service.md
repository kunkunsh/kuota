# Kuota Refresh Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long-lived Kuota consumers safe and responsive by adding per-provider TTL caching, singleflight, cooldown and honest stale display without changing the existing CLI JSON schema.

**Architecture:** A process-local `createQuotaService()` owns one map of provider slots and reuses the existing `QuotaProvider.read()` effects. It keeps only normalized snapshots, derives `QuotaObservation`, and uses an injected clock for deterministic tests. The TUI constructs this service once. The CLI remains independently executable and its schemaVersion 1 JSON is unchanged.

**Tech Stack:** TypeScript 5.9, Effect TS, Vitest 5.1, Vite Plus 1.5 (`vp`), UniView `@uniview/tui-react`, Bun development runner and Node 24 built artifacts.

**Spec:** [`docs/superpowers/specs/2026-11-06-kuota-phase2-design.md`](../specs/2026-11-06-kuota-phase2-design.md).

## Global Constraints

- Work on `/Users/hk/Dev/kuota` (not the old `/Users/hk/Dev/quota`). User may give this plan to a different AI.
- Do not implement cloud sync, Kunkun plugin, Keychain, OAuth sign-in or token refresh in this plan.
- `QuotaSnapshot` stays structurally identical; `status --json` keeps `schemaVersion:1` and one JSON object on stdout.
- Never log raw provider stdout/stderr, token, response body, user email or credential file.
- Never call real provider CLIs from unit tests. Fake providers return Effect results and an injected fake clock; fake timers must be isolated per test.
- Tests RED before implementation, GREEN after; follow every slice with `bun run test`, `bun run typecheck`, `bun run check`, `bun run build` as applicable.
- `@kuota/core` stays platform-independent; no `node:*` imports.
- **Do not make a false promise:** in-process TTL only helps a persistent TUI/host; separate CLI invocations have distinct caches.
- If implementation changes the proposed interface materially, update the spec and handoff first and ask HK for review if behavior/security changes.

## Review Focus

Singleflight promise ownership; Effect laziness; `Effect.runPromise` rejection; exception-to-snapshot conversion; time travel and invalidation races; stale never labeled live; rate-limited forced refresh; cache poisoning; abnormal process exit; output schema stability; per-provider failure isolation.

---

## Task 0 — Baseline and isolation

**Files:** Read `packages/providers/src/registry.ts`, `packages/providers/src/index.ts`, `packages/core/src/types.ts`, `packages/tui/src/{main,app}.tsx`, `packages/cli/src/commands.ts`. No edits.

- [ ] Run `git status --short --branch`, `git log -1 --oneline`; preserve any user edits.
- [ ] Run `bun run test`, `bun run typecheck`, `bun run check`, `bun run build`. Record version and exact counts in a dated implementation log, not in a source test.
- [ ] Confirm no agent or test invokes `claude` login, `agy` auto-update, or a model prompt.
- [ ] Decide source file layout: add `packages/providers/src/service.ts` and `service.test.ts`; export from `packages/providers/src/index.ts`.

**Acceptance:** baseline passes, clean or understood worktree, local docs updated with discrepancies. Commit none for read-only baseline.

## Task 1 — Typed observation wrapper and validation

**Files:**

- Create `packages/core/src/observation.ts`, `packages/core/src/observation.test.ts`.
- Modify `packages/core/src/index.ts` to export types/constructors.

**Interfaces to implement:**

```ts
import type { QuotaSnapshot } from "./types.js";

export type Freshness = "live" | "cached" | "stale";
export interface QuotaObservation {
  readonly snapshot: QuotaSnapshot;
  readonly freshness: Freshness;
  readonly observedAt: string;
  readonly checkedAt: string;
  readonly ageMs: number;
  readonly nextAttemptAt: string | null;
  readonly latestErrorCode: string | null;
}

export function makeObservation(input: {
  snapshot: QuotaSnapshot;
  freshness: Freshness;
  checkedAtMs: number;
  nowMs: number;
  nextAttemptAtMs?: number | null;
  latestErrorCode?: string | null;
}): QuotaObservation;
```

Implementation rules: parse `snapshot.fetchedAt`, if invalid do not emit `NaN` or `Invalid Date`; either reject with sanitized `PROTOCOL_ERROR` in the provider service or use injected checked time as observed time; document choice. `ageMs = max(0, now - observed)`, `observedAt` always corresponds to the snapshot acquisition, `checkedAt` is most recent probe attempt (not most recent UI paint). Null `nextAttemptAt` when allowed to attempt now. `latestErrorCode` is sanitized; never transfer vendor response content.

- [ ] Write failing tests: live age=0, cached age=61_000, stale age with error, negative clock skew clamps 0, invalid `fetchedAt` is never exposed as an invalid timestamp, frozen object doesn't mutate input.
- [ ] Run `bun run test -- packages/core/src/observation.test.ts` (confirm RED; adapt Vitest file argument syntax only if necessary).
- [ ] Implement small pure constructor; no Effect, Node or network imports. Ensure `QuotaSnapshot` schema stays unchanged.
- [ ] Confirm GREEN, typecheck; commit `feat(core): add nonbreaking quota observation metadata`.

## Task 2 — Core service: TTL and parallel provider isolation

**Files:** `packages/providers/src/service.ts`, `service.test.ts`, `packages/providers/src/index.ts`.

**Proposed minimal contract:**

```ts
import { Effect } from "effect";
import type { ProviderId } from "@kuota/core";
import type { QuotaObservation } from "@kuota/core";
import type { QuotaProvider } from "./registry.js";

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

export function createQuotaService(options?: {
  providers?: readonly QuotaProvider[];
  now?: () => number;
  policies?: Partial<Record<ProviderId, Partial<RefreshPolicy>>>;
}): QuotaService;
```

Per-provider slot should carry `lastGood?: QuotaSnapshot`, `lastCheckedAtMs`, `nextAttemptAtMs`, `latestFailureCode`, `inflight?: Promise<...>`, `generation:number`. Leave normalized provider snapshot ownership inside `QuotaProvider.read`. `Effect.promise(() => ...)` starts evaluation lazily. Catch `Effect.runPromise` failures and translate to a sanitized `PROVIDER_FAILED` snapshot (similar to registry). Do not confuse absent provider with unauthenticated.

Recommended initial defaults (adjust only with documented reason):

```ts
const defaults = {
  codex: { successTtlMs: 60_000 },
  claude: { successTtlMs: 900_000 },
  antigravity: { successTtlMs: 300_000 },
} as const;
const common = {
  errorRetryMs: 60_000,
  authRetryMs: 300_000,
  rateLimitCooldownMs: 900_000,
  staleMaxAgeMs: 86_400_000,
};
```

Algorithm (per id):

1. If `inflight` exists, join it (singleflight).
2. If `now < nextAttemptAt` and cached success exists, return cached/stale observation as appropriate; for no success return most recent unavailable snapshot (or synthesized sanitized unavailable if needed).
3. If good cache younger than TTL and `force !== true`, return `cached` with recomputed age.
4. Otherwise initiate one provider probe; capture attempt timestamp; `Effect.runPromise(provider.read())` behind a safe wrapper. Store results only if generation matches.
5. On success (`status:"ok"` or `"partial"` **with measurable windows**): set lastGood and cooldown according to policy; report `live`.
6. On `RATE_LIMITED`: preserve lastGood if within `staleMaxAgeMs`, set at least rateLimitCooldown, return `stale` with latest error; do not immediately force retry.
7. On `AUTH_REQUIRED`: use `authRetryMs`; optionally clear lastGood immediately to avoid showing a prior account's quota (recommended: **clear**; document reason).
8. On any other failure: 60s retry; preserve lastGood only up to 24h and label `stale`. If no success or expired, return failure snapshot with truthful status/error.
9. Always clear `inflight` in `finally` only if it is the same promise; an invalidated request must not restore old data.

Important corner: the service's comparison of `RATE_LIMITED` and `AUTH_REQUIRED` uses **errorCode**, not only `status`, because current adapters represent rate limiting as `unavailable`.

- [ ] RED: two reads at t=0 call provider once; third at t=30s returns cached; at t=60s re-probes.
- [ ] RED: order of requested IDs is preserved; unknown registered provider produces `unsupported/NOT_REGISTERED` without aborting others.
- [ ] RED: a provider throwing/rejecting doesn't block a concurrent healthy provider.
- [ ] RED: partial with one real window is cacheable; empty `ok` is not silently considered measured.
- [ ] RED: time moving backwards does not make a frozen cache permanent.
- [ ] GREEN: implement only TTL, read/peek, typed defaults, per-id failure isolation; ensure each test uses in-memory counters and controlled `now`.
- [ ] Add bounded concurrency preserving current behavior (3). If `Effect.all` is used, keep `concurrency:3`.
- [ ] Commit `feat(providers): add process-local quota service with TTL`.

## Task 3 — Singleflight, cooldown, and invalidation race

**Files:** same service and tests.

- [ ] RED: run two `Effect.runPromise(service.read(["claude"]))` concurrently using a deferred `Promise`; before resolution count=1, both get the same normalized result.
- [ ] RED: an unrelated Codex request is not serialized behind a delayed Claude request.
- [ ] RED: 429 then `force:true` before deadline performs **zero** extra probes; at deadline one probe is allowed. A stale result includes `latestErrorCode:"RATE_LIMITED"` and `nextAttemptAt`.
- [ ] RED: `AUTH_REQUIRED` does not retain a previously successful _other-account_ snapshot; re-read follows auth retry policy.
- [ ] RED: `invalidate("claude")` during an inflight probe means delayed old response cannot repopulate cache; subsequent call does a fresh probe. Test `invalidate()` for all providers too.
- [ ] RED: rejecting provider does not leave a stuck inflight promise. A subsequent retry succeeds.
- [ ] RED: a forced refresh can bypass success TTL, but not rate-limit cooldown. State explicitly what force does for non-429 transient error cooldown and test it.
- [ ] GREEN: add promise slot and per-provider generation counter. Avoid `try/finally` that mistakenly clears newer inflight slot. Consider returning the settled promise to all waiters; convert unexpected errors once.
- [ ] Run full test suite, typecheck, check, build; commit `feat(providers): singleflight cooldown and stale fallback`.

## Task 4 — Honor `Retry-After` without exposing raw HTTP

**Files:** `packages/providers/src/claude/index.ts`, `claude.test.ts`, `packages/providers/src/service.ts`, `service.test.ts`, optional pure helper `packages/providers/src/retry-after.ts`.

**Design gate:** Current `QuotaSnapshot` only has `errorCode`; it cannot carry an upstream `Retry-After` deadline. First choose one of:

- A. Keep simple fixed 15-minute 429 cooldown in Phase 2 (safe default, no schema changes).
- B. Add an **internal typed transport result** with retry metadata, not part of `QuotaSnapshot`/CLI JSON. The service consumes it, and tests ensure headers never leak.

Use A unless there is evidence the private endpoint frequently returns longer cooldowns. If B, extend `QuotaProvider` with backward-compatible optional `readDetailed` only and prove existing adapters continue to work.

- [ ] RED: 429 is mapped to stable `RATE_LIMITED`, never HTTP body; repeat invocation in same process is throttled.
- [ ] RED (if B): `Retry-After: 120`, valid HTTP date, negative/absurd/invalid value all clamp safely; >15-min valid server delay wins.
- [ ] GREEN: no public schema change; private transport changes must be test-covered.
- [ ] Commit `fix(providers): respect bounded rate limit retries` if B chosen, otherwise mark deferred in handoff.

## Task 5 — Integrate a single service into UniView TUI

**Files:** `packages/tui/src/main.tsx`, `app.tsx`, `app.test.tsx`; optionally `main.test.ts` (use injected service factory, not real TTY).

Current `startTui` creates new `builtInProviders()` and calls `readAll` on each `refresh`. Replace with one `createQuotaService` instance in the **`startTui()` closure**. Because `QuotaApp` currently takes `QuotaSnapshot[]`, decide whether to add optional `observations?: QuotaObservation[]` or migrate props with backwards-compatible display tests. Keep shortcuts.

- [ ] RED: a fake service with count=1 after initial render and cached results on a non-forced reread. `r` triggers `force:true` except active 429 cooldown.
- [ ] RED: show `Cached · 34s ago` and `Stale · last successful sample ... · retry after ...` without changing percentages to zero.
- [ ] RED: selected filter `1/2/3/a` does **not** call the network; display sanitized provider string and reset time.
- [ ] RED: rapid repeated refresh is coalesced (existing `loading` guard) and the UI isn't left loading on error.
- [ ] RED: `SIGINT`, `q`, render failure, late async completion all leave the render instance cleaned up. Do not write after destroy.
- [ ] GREEN: implement smallest UI change using existing UniView components (`Panel`, `Box`, `Text`, `useInput`). Ensure accessible high-contrast labels without color reliance.
- [ ] Run `bun run test`, `bun run check`, `bun run typecheck`, `bun run build`; commit `feat(tui): show cached and stale quota observations`.

## Task 6 — Preserve CLI compatibility and document semantics

**Files:** `packages/cli/src/commands.ts`, `commands.test.ts`, `README.md`, `docs/implementation-status-2026-11-05.md` (or append a new dated status entry).

- [ ] RED: `status --json` still parses to exactly `{schemaVersion:1,generatedAt,providers,errors}`; each provider snapshot has only its existing fields.
- [ ] RED: `status --provider bogus --json` exits 2 with error `UNKNOWN_PROVIDER` and no extra stdout.
- [ ] RED: `providers --json` and `doctor --json` remain stable. Missing `agy`, logged-out Claude, and Codex RPC timeout are isolated.
- [ ] GREEN: if CLI uses new service internally, project observation metadata away. Consider keeping `readAll` CLI path unchanged if the new service offers no benefit for a one-shot process.
- [ ] Update README with precise statement: "TUI and future host process cache requests in memory; independently run CLI processes do not share this cache." No overclaiming OS-wide enforcement.
- [ ] Full gate: `bun run test && bun run typecheck && bun run check && bun run build`, then `node packages/cli/dist/main.mjs providers --json` and `status --json` without publishing secrets.
- [ ] Commit `docs: explain Kuota refresh and CLI cache boundaries`.

## Task 7 — Manual operator acceptance on Mac mini

- [ ] In **Terminal.app**, `cd /Users/hk/Dev/kuota`, `bun run tui`, press `1`, `2`, `3`, `a`, `r`, `q`.
- [ ] Verify `r` during cooldown displays next attempt, no rate-limit storm; screen restore on `q` and Ctrl-C.
- [ ] Confirm `claude auth status --json` does not prompt; if logged out, displayed status is unauthenticated without trying login.
- [ ] Run `ps`/Activity Monitor to ensure no orphan `codex app-server` or agy children. This is observational; do not indiscriminately kill unrelated processes.
- [ ] Record the manual test date, versions, caveats in dated status doc. Remote Desktop Commander pseudo-terminal **cannot** substitute for this check on current Mac mini setup.

## Completion criteria (all must hold)

- [ ] Unit tests for TTL, singleflight, rate limit, stale, identity invalidation, race, per-provider isolation are green.
- [ ] Existing 32 baseline tests still pass; no regressions in `check`, `typecheck`, `build`.
- [ ] CLI JSON schema 1 unchanged and stdout remains machine-readable.
- [ ] No credential material in repo, logs or snapshots; no browser/login/Keychain interaction.
- [ ] TUI session uses one service instance, handles keyboard quit, and distinguishes live/cached/stale.
- [ ] No claim of cache persistence across separate CLI OS processes.
- [ ] `HANDOFF.md` completed-task checkboxes updated with actual commit hashes and real verification results.

**Potential follow-on (do not implement here):** persistent snapshots or local daemon, explicit `--refresh`/`--watch` mode, Prometheus metrics, OS notifications, account-aware history, cloud cron schedule, Web UI.
