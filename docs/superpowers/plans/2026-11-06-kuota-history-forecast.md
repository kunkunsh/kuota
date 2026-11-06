# Kuota Pacing, Local History & Forecast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add honest time-based quota pacing and opt-in local time-series history/ETA to Kuota without changing the existing `status --json` schema or uploading any user data.

**Architecture:** Pure TypeScript functions and schemas live in `@kuota/core`, Node/Bun JSONL file I/O in a separate history package, provider collection in the CLI orchestration layer, optional UniView presentation. Later Kunkun/Cloud consumers call the same versioned public types, but no Worker/D1/R2 dependencies are introduced in this plan.

**Tech Stack:** TypeScript 5.9, Effect 3.22, Effect Schema and `@effect/cli`, Bun workspaces, Vite Plus 1.5 (`vp test`, `vp pack`), Vitest, `@uniview/tui-react` (future TUI task).

**Spec:** `docs/specs/2026-11-06-kuota-history-cloud-spec.md` and `docs/specs/2026-11-06-kuota-dashboard-ux.md`. Research: `docs/research/2026-11-06-kuota-telemetry-cost-research.md`. Existing baseline: `HANDOFF.md`, `docs/implementation-status-2026-11-05.md`.

## Global Constraints

- Workspace `/Users/hk/Dev/kuota` on HK Mac mini. **Preserve dirty worktree**, including pre-existing `.gitignore` edit; no reset/clean.
- Existing `QuotaSnapshot` and `kuota status --json` `{schemaVersion:1, generatedAt, providers, errors}` are frozen; implement new `kuota pace/history/forecast` contracts separately.
- Core package remains no Node imports; provider OAuth/keychain details and logs never enter history, CLI JSON, or telemetry.
- No daemon, Cloudflare deployment, account sync, research contribution or GitHub push authorized by this plan. Future Cloud steps need separate approval.
- Do not force login, auto-refresh private OAuth, or bypass 429. A valid cache can be recorded only once per source `fetchedAt`+window, not hourly as fresh observations.
- Test with fixtures/fake clock/fake fs where possible. Real `codex app-server`, `agy`, `claude` may be sampled once for smoke only, respecting cooldown. Claude logged out in last baseline.
- Use `@uniview/tui-react`, do not replace it. Keep CLI fast/noninteractive, `--json` exactly one JSON object on stdout.
- Plans split: H1 math; H2 history; H3 forecast; H4 TUI; H5 Kunkun/cloud separately after review.

## Review Focus

1. **Rolling/unknown reset:** no white marker or forecast without known fixed epoch; tests in Task 1 and Task 4.
2. **Duplicate/stale upload:** repeated `fetchedAt` cannot be new independent data; tests in Task 2 and Task 3.
3. **Partial JSONL last line/process crash:** recover complete lines without deleting valid history; tests in Task 3.
4. **Account-switch / missing identity:** events must never merge unknown account across sessions/devices; tests in Task 2 and Task 3.
5. **Spiky 1h use and 429:** no false high-confidence ETA; providers not forcibly probed after cooldown; tests in Task 4 and Task 5.

---

## File map / interfaces

```
packages/core/src/metrics/pace.ts          # fixed-window math only
packages/core/src/metrics/pace.test.ts
packages/core/src/history/schema.ts        # event types / Effect Schema
packages/core/src/history/schema.test.ts
packages/core/src/metrics/forecast.ts      # pure robust ETA
packages/core/src/metrics/forecast.test.ts
packages/core/src/index.ts                 # exports; no existing export removed
packages/history/package.json              # NEW optional Node package
packages/history/src/local-jsonl.ts        # append/read/dedupe/rotation
packages/history/src/local-jsonl.test.ts
packages/history/src/index.ts              # small public API
packages/cli/src/history-commands.ts       # `pace`, `collect`, `history`, `forecast`
packages/cli/src/history-commands.test.ts
packages/cli/src/commands.ts               # register new subcommands, keep `status` stable
packages/tui/src/history-view.tsx           # optional compact series view
packages/tui/src/history-view.test.tsx
docs/implementation-status-2026-11-06.md   # new actual results only
HANDOFF.md                                 # add new plan, state, next steps after verification
```

### Task 1: Pure ideal pace function (H1, first implementable slice)

**Files:** Create `packages/core/src/metrics/pace.ts`, `pace.test.ts`; modify `packages/core/src/index.ts`.

**Interfaces:**

```ts
export type PaceQuality = "exact" | "inferred";
export interface PaceInput {
  now: Date;
  startAt: Date | null;
  resetAt: Date | null;
  usedPercent: number | null;
  semantics: "fixed" | "rolling" | "first_use" | "unknown";
  startSource: "provider" | "inferred" | "unknown";
}
export interface PaceResult {
  elapsedFraction: number;
  idealUsedPercent: number;
  idealRemainingPercent: number;
  actualUsedPercent: number;
  paceDeltaPoints: number;
  paceRatio: number | null;
  quality: PaceQuality;
}
export function calculatePace(input: PaceInput): PaceResult | null;
```

- [ ] **Step 1 — red test:** fixed 7d at 3.5d with `usedPercent:55` => `idealUsedPercent:50`, `idealRemainingPercent:50`, `paceDeltaPoints:5`, `paceRatio:1.1`; test 0% start, exact reset boundary, 100% used, negative/NaN input, invalid end≤start, unknown start, rolling window, explicit first-use with known start.
- [ ] **Step 2 — run red:** `bun run test packages/core/src/metrics/pace.test.ts` (expect missing import/function).
- [ ] **Step 3 — minimal implementation:** clamp elapsed [0,1], reject invalid timestamps/percent/missing start and `rolling/unknown`, accept `first_use` only when provider supplies concrete start. Use Date.getTime; no runtime I/O.
- [ ] **Step 4 — green:** targeted tests pass, `bun run typecheck`, `bun run test` pass. Export from core index.
- [ ] **Step 5 — commit:** `git add packages/core/src/metrics/pace.ts packages/core/src/metrics/pace.test.ts packages/core/src/index.ts && git commit -m 'feat(core): add fixed-window quota pacing'` (only if local git state is safe; never include unrelated `.gitignore`).

### Task 2: Versioned journal schema and normalization (H2)

**Files:** Create `packages/core/src/history/schema.ts`, `schema.test.ts`; modify `packages/core/src/index.ts`.

**Interfaces:**

```ts
export type WindowSemantics = "fixed" | "rolling" | "first_use" | "unknown";
export interface QuotaHistoryEventV1 { /* fields fixed by history-cloud-spec §3 */ }
export function historyEventsFromSnapshot(snapshot: QuotaSnapshot, options: {
  deviceId: string;
  accountScope: string | null;
  recordedAt: string;
  semanticsForWindow: (id: string) => WindowSemantics;
  startForWindow: (id: string) => string | null;
}): readonly QuotaHistoryEventV1[];
```

- [ ] **Step 1 — red test:** 2 valid windows emit 2 typed per-window events with same fetchedAt; invalid percent does not create fake used=0; unauthenticated creates sanitized error event; unknown account remains null and does not manufacture email; stable event ID across retries, no raw source payload/token fields.
- [ ] **Step 2 — run targeted red test.**
- [ ] **Step 3 — implement Effect Schema decode + redaction:** exact field names and version as spec; disallow unknown secret-bearing fields; derive event identity from safe metadata not credentials. Source `startAt` must be provider-backed or null; no automatic seven-day assumption here.
- [ ] **Step 4 — green tests + full typecheck.**
- [ ] **Step 5 — commit small isolated change.**

### Task 3: Node-only JSONL store (H2)

**Files:** Create `packages/history/{package.json,src/index.ts,src/local-jsonl.ts,src/local-jsonl.test.ts}`; modify root `tsconfig.json` / workspace config only if necessary.

**Interfaces:**

```ts
export interface JournalStore {
  append(events: readonly QuotaHistoryEventV1[]): Promise<{ written: number; duplicates: number }>;
  read(options: { from: string; to: string; provider?: string; windowId?: string }): AsyncIterable<QuotaHistoryEventV1>;
}
export function createLocalJsonlJournal(options: { directory: string; maxFileBytes?: number }): JournalStore;
```

- [ ] **Step 1 — red test:** append 2 and reread 2; repeated event ID writes 0 new; two concurrent appends yield complete newline records without corruption; partial trailing line is recognized and not mistaken for valid data; UTC date partition selection, from/to filter, missing directory creation.
- [ ] **Step 2 — run red tests.**
- [ ] **Step 3 — implement:** resolve explicit directory, per-process serialized append queue + one writer lock; enforce safe relative file segments (no provider-supplied paths), size caps, newline-delimited JSON; read streams bounded per-day, Effect Schema decode invalid lines into diagnostic/error count, no credential logging. Dedup robust across process restart using a small index/checkpoint or scanning current partition. Do not require a daemon.
- [ ] **Step 4 — green tests; stress 1,000 events and process restart.**
- [ ] **Step 5 — commit.**

### Task 4: Forecast with explicit confidence (H3)

**Files:** Create `packages/core/src/metrics/forecast.ts`, `forecast.test.ts`, export from index.

**Interfaces:**

```ts
export type ForecastQuality = "unsupported" | "insufficient" | "low" | "medium" | "high";
export interface ForecastInput { now: Date; resetAt: Date; observations: readonly QuotaHistoryEventV1[]; mode: "all-window" | "recent-activity"; }
export interface ForecastResult { slopePercentPerHour: number | null; exhaustedAt: string | null; projectedUsedAtResetPercent: number | null; sampleCount: number; observedSpanHours: number; quality: ForecastQuality; reasons: readonly string[]; }
export function forecastQuota(input: ForecastInput): ForecastResult;
```

- [ ] **Step 1 — red fixtures:** 0/1 samples => insufficient, 55% at 3.5/7d slope => exhaustion ~15h before reset, 1h burst yields low confidence, rolling window => unsupported, a reset crossing breaks epoch, duplicate `observedAt` ignored, zero slope -> `exhaustedAt:null`, negative and out-of-order source data gets rejected/split, stale input affects quality.
- [ ] **Step 2 — run red tests.**
- [ ] **Step 3 — implement:** one epoch+account+window only, monotonic fixed used%, robust capped-weight median of interval slopes, source timestamp not upload time, quality thresholds per spec. No fake 95% numeric CI.
- [ ] **Step 4 — green tests + deterministic fake-clock backtesting fixture.**
- [ ] **Step 5 — commit.**

### Task 5: New CLI surfaces preserving v1 (H1–H3)

**Files:** Create `packages/cli/src/history-commands.ts`, tests; modify existing `commands.ts` without changing `status` output.

**Interfaces/commands:**

```text
kuota pace --provider codex --json            # no history required; independent per-window results
kuota collect --once --json                   # normalized and deduplicated journal append
kuota history --provider codex --from ... --to ... --json
kuota forecast --provider codex --window weekly --json
```

- [ ] **Step 1 — red CLI tests:** `status --json` byte-shape unchanged; new commands have `{schemaVersion:1, generatedAt, ...}` independent envelopes; `pace` unknown start returns null/reason; stdout one JSON object and stderr sanitized; `collect` does not silently create cloud traffic, respects rate limit cooldown; invalid date/provider exit 2.
- [ ] **Step 2 — run red tests.**
- [ ] **Step 3 — implement @effect/cli commands:** inject provider clock/local journal directory for tests, no runtime credential in args/log, avoid repeated real provider probes. Use platform-specific config data directory with an env override only for testing/user explicitly selected path.
- [ ] **Step 4 — green + `bun run test`, `bun run typecheck`, `bun run check`, `bun run build`, Node built CLI smoke.**
- [ ] **Step 5 — commit.**

### Task 6: UniView compact history + handoff docs (H4)

**Files:** Create `packages/tui/src/history-view.tsx` and test; modify `app.tsx`, `README.md`, `HANDOFF.md` and verification log.

- [ ] **Step 1 — red snapshot tests:** fallback with no history; selected provider/window displays remaining, white pace marker rendered in ASCII/terminal cell semantics with an explicit legend, trend arrow and ETA quality; 80×24 and narrower terminals, keyboard shortcuts, no endless refresh loop.
- [ ] **Step 2 — targeted red tests.**
- [ ] **Step 3 — implement using UniView primitives** already installed; no imported browser shadcn components; keep real TTY manual QA separate.
- [ ] **Step 4 — green + manual Mac Terminal smoke (HK may have to run), retain truthful status if TTY inaccessible remotely.**
- [ ] **Step 5 — docs/handoff updated and commit.**

### Task 7: Kunkun React/cloud follow-on — **separate authorization**

**Files (new later):** `packages/kunkun/`, `apps/kuota-web/`, `apps/kuota-cloud/`; do **not** create during H1–H4.

- [ ] Confirm exact Kunkun v2.1 checkout/API and permissions broker, read its `AGENTS.md`, obtain approval for scoped permission manifest.
- [ ] Build shared typed `snapshot+history+forecast` host RPC, React shadcn Overview/Detail/History UI from UX spec, 10-screen concept references, keyboard a11y.
- [ ] Separate consent screen for private sync and research, auth and user partition, batched upload idempotency, adaptive schedule.
- [ ] Implement D1 14d hot + immutable R2 archive/manifest/verify/delete + recovery tests, daily aggregate, cost monitoring; no destructive hot purge until archive recovery proven.
- [ ] Privacy audit, public cohort suppression, API/MCP rate limits; consent review.

## Finish criteria / handoff gate

- All newly introduced tests pass **freshly**; old 32 baseline tests still pass; Vite Plus formatter/linter/typecheck/build pass; built Node `kuota` CLI doesn't require Bun runtime.
- No secret fields in journal/CLI/TUI fixture, data encryption/security claims carefully scoped. No real cloud upload by default.
- Record current `git status`, exact commit hashes, test output, mocked vs live provider status, and cloud/Notion/Drive links in `HANDOFF.md`.
- If any API is unsupported or source lacks window start, leave an explicit unavailable state rather than papering over it.
