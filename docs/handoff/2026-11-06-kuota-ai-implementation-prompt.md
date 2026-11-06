# Copy/Paste Prompt — Implement Kuota Local History, Forecast & Future Kunkun Dashboard

> Date 2026-11-06. Prepared for HK to paste into another coding AI (Gemini/Claude/Codex/etc.). **Read first; do not assume design mockups are running code.**

---

## PROMPT START — paste everything below into the other AI

You are a senior TypeScript/Effect engineer implementing **Kuota** for HK. You have access to HK's Mac mini at `/Users/hk/Dev/kuota`. Your task is to independently review, clarify and implement the **already approved local-first milestones** in small, verified increments. Do not implement paid cloud infrastructure, silently enable background telemetry, or change architecture without checking the project's source of truth. This is a real existing monorepo, **not** a greenfield scaffold.

### 0. Mandatory first action: inspect actual repo

1. Resolve `/Users/hk/Dev/kuota`, read its `AGENTS.md` (if present), then `HANDOFF.md` in full. Run `git status --short --branch`, `git log -3 --oneline` and inspect package layout and scripts. **Preserve the pre-existing modified `.gitignore` and every unrelated file.** No `git reset --hard`, `git clean`, broad destructive operation or blind mass formatting.
2. Read all of these, in order, before coding:
   - `docs/specs/2026-11-06-kuota-dashboard-ux.md` — 14 user stories, page IA, interactions, shadcn component map, empty/privacy states.
   - `docs/specs/2026-11-06-kuota-history-cloud-spec.md` — versioned event, mathematical pacing, robust forecast, D1/R2 and consent design.
   - `docs/design/2026-11-06-kuota-concept-gallery.md` — **11 page images** and especially **image QA corrections**; never copy fabricated numbers from an image.
   - `docs/research/2026-11-06-kuota-telemetry-cost-research.md` — official CF references + 100/1000/10000/100000 user estimates, archival safety, DuckDB tradeoffs.
   - `docs/superpowers/plans/2026-11-06-kuota-history-forecast.md` — 7 TDD tasks, exact file paths, acceptance gates.
   - `docs/superpowers/plans/2026-11-06-kuota-refresh-service.md` and `2026-11-06-kuota-provider-hardening.md` — shared TTL, 429 cooldown, source hardening: prerequisites for unattended polling.
   - `docs/implementation-status-2026-11-06.md` — actual latest test/status record. Older `2026-11-05` report is historical.
   - Actual `packages/core`, `packages/providers`, `packages/cli`, `packages/tui` source **and** their tests. Do not infer types from aspirational docs.
3. Inspect `package.json`, `vite.config.ts` and `tsconfig.json` before changing dependencies. The chosen stack is **TypeScript, Effect 3, `@effect/cli`, Bun workspaces, Vite Plus 1.5, UniView (`@uniview/tui-react`)**. Do not replace UniView with Ink or rebuild tooling in a different framework. Preserve Node runtime build of the CLI.

### Cloud docs and Notion (reference, not permission to deploy)

- Google Drive Kuota folder: https://drive.google.com/drive/folders/10RVDLtwfJGPQnI9sX5LKpkqGVqLdXdU5
- All 11 shadcn page concept PNGs: https://drive.google.com/drive/folders/1LndhYb13cKjFijWzclnRwiZ1whEpt4n-
- UX/spec: https://drive.google.com/file/d/16pDKg1doGfwdghALxjw_gm0aJxCTFfc7/view
- Technical history/cloud design: https://drive.google.com/file/d/1pRMXltsLe2WGeS7LQ5azmPAXFIO0oD9t/view
- Cost/research: https://drive.google.com/file/d/1UNiWoditK8E9a9VtrWuftUhieQKJtxRO/view
- TDD implementation plan: https://drive.google.com/file/d/1zONVPtLPS59C_D2tyMxlLzMPBgSiVV8C/view
- Notion spec and design gallery: https://app.notion.com/p/410cefcfcbfd814fb4b9eff12b982b15?pvs=204
- Notion Kunkun Product Intent KUN-136: https://app.notion.com/p/40fcefcfcbfd812bb2aaeb13201ee108?pvs=204

### 1. Project goal and non-negotiable product semantics

- Reusable `@kuota/core` **without Node APIs**: source-normalized quota windows + pure pacing/forecast math.
- `@kuota/providers` reads CLI/official-existing-local sources independently; one provider failure does not block others.
- `@kuota/cli` uses Effect CLI, outputs human text and machine-readable **one-object JSON**; `@kuota/tui` renders with HK's UniView. Future Kunkun React/shadcn plugin consumes the same data contracts through a permissioned bridge.
- Don't merge percentages across vendors, accounts or quota windows; separate used/remaining, source freshness, reset semantics and measured vs estimated fields.
- **White ideal-progress tick** = mathematical linear elapsed time between **trustworthy start and reset**; exactly one tick when valid, none otherwise. `used` bar tick at ideal used%; `remaining` bar tick at ideal remaining%. `rolling`, missing start or unproved first-use epoch do **not** get a fake tick.
- **Forecast** = different, **dashed** estimated usage trajectory computed from comparable historical points; must show `insufficient`, `low`, `medium`, `high`, `unsupported` and source window; don't display uncalibrated numeric confidence probabilities. Rolling/refilling windows need a validated separate model; the fixed-window model must return `unsupported` for these.
- `effectiveTokenCap ≈ Δtokens / (ΔquotaUsed/100)` is **workload-equivalent exploratory research only**, not official tokens per subscription. Must match provider, account, model mix, cache weighting, epoch, source coverage; cannot infer official limits from quota percent alone.
- **Local-first:** no account/login required for status + history; no default cloud sync or research contribution. Private sync and research opt-in are **independent** choices, both OFF; free-tier usage does not require trading privacy. Prompt bodies, OAuth tokens, cookies, filesystem paths and project names never enter research uploads. Project activity needs its own separate permission and source, never infer active work hours from quota percent.

### 2. Verified baseline / explicit partial work

- At latest check: **8 suites, 45 tests passing** after a small H1 pure math addition; `bun run typecheck` passed. Earlier 32 baseline tests remain. `bun run check/build` have **not** been rerun after that addition; run them yourself before calling it complete.
- `packages/core/src/metrics/pace.ts` + `pace.test.ts`, and export in `packages/core/src/index.ts` **already exist, with 13 passing tests**. Read/review them, avoid recreating or overwriting; one caveat: no real provider's startAt is yet wired into this pure function, so it does NOT create a live white tick in the CLI/TUI today.
- `kuota status`, `providers`, `doctor`, `tui` exist; JSON status envelope v1 `{schemaVersion:1, generatedAt, providers, errors}` is **frozen**. `kuota pace`, `collect`, `history`, `forecast` are still proposals until implemented.
- Codex adapter: official-ish `codex app-server` local JSON-RPC rate-limit probe and fixtures + one historical live smoke. Antigravity: `agy -p /usage --output-format json` and one historical live smoke. Claude OAuth quota is mock tested but on this Mac mini Claude was **logged out**; do not force a login or access Keychain.
- No remote git configured at planning time. **Do not push, publish npm or deploy** unless HK later explicitly authorizes it. Current tree also contains uncommitted documentation and the unrelated `.gitignore` edit.

### 3. Implementation order: one narrow vertical slice at a time

**Milestone A — correctness and rate-limit hygiene (required before scheduler):**

- [ ] Review existing H1 pace math and 13 tests; verify orientation and unknown-start state; add only bugs found with red tests.
- [ ] Implement Phase 2 refresh-service Tasks 1–6 with fake clock/provider sources: TTL cache, singleflight per provider/account, 429 `Retry-After`/backoff, stale-vs-fresh, refresh invalidation and independent failures. No daemon required yet. Recheck CLI schema compatibility and TUI freshness state.
- [ ] Provider-hardening tasks: test Claude credential precedence and private API fallbacks, Codex streaming app-server parse, agy structured output/proc timeout. No credentials leak or automatic sign-in. Watch for CLI version drift and 429.

**Milestone B — local history journal (implements US-05/12):**

- [ ] Add `packages/core/src/history/schema.ts` using Effect Schema with versioned `QuotaHistoryEventV1`, per-window `observedAt` (original source fetch time), `recordedAt`, `eventId`, provider, accountScope (opaque/null), deviceId (local), window epoch, semantics, observed quota, normalized source and sanitized error. No raw provider payload or credentials.
- [ ] Add `packages/history` Node/Bun-only package with append-only UTC-date-partitioned JSONL; idempotent append even across program restart, concurrent writer lock, incomplete last line recovery, bounded read/queries, `from/to/provider/window` filtering, export, retention. Keep `@kuota/core` platform-independent.
- [ ] Add `kuota collect --once --json` and `kuota history --provider codex --from ... --to ... --json` with separate versioned envelopes; don't change status v1. Respect TTL/backoff and error statuses. Collect real `fetchedAt`, never count repeated cached readings as new consumption. Do not auto-install cron.

**Milestone C — real forecast (implements US-03/04):**

- [ ] Add pure `forecastQuota` to `@kuota/core`: same provider/account/device-window/epoch only, sort + dedupe, split actual reset/counter drop events, reject negative deltas and stale/out-of-order values; no reliable ETA without multiple independent valid observations.
- [ ] Baseline robust slope (weighted median of positive interval rates, cap long-gap influence), quality tiers and reasons; calculate `exhaustedAt`, `projectedUsedAtResetPercent`, sample count, observed span. Compare recent-active vs full-window only with enough points; no fake 95% statistical confidence interval.
- [ ] Add `kuota forecast --provider ... --window ... --json`; default no forecast for missing start/unmodeled rolling/unknown account changes. Add synthetic multi-epoch and spiky-1h fixtures, backtest when enough real history is available.

**Milestone D — UniView UI / distribution:**

- [ ] Display each window actual remaining, reset, source age and exactly one white/faint ideal marker when comparable in TUI cells; safe fallback if insufficient. Optional inline sparklines and confidence. Test 80×24 / smaller width with UniView renderer; manual real Terminal.app TTY smoke required.
- [ ] Preserve install-free distribution goal: build Node CLI artifact, measure package size and startup, write cross-platform install plan; no public release until HK approves.

**Milestone E — Kunkun React/shadcn UI (after reviewing actual Kunkun v2.1 SDK):**

- [ ] Inspect Kunkun v2.1 repo and its `AGENTS.md`, Deno plugin permission broker, scheduler, host APIs and planned cloud sync. Never guess or bypass permissions; write an integration ADR if APIs ambiguous.
- [ ] Use existing shadcn/ui, shadcn-studio license-checked components and shared `@kuota/core` types; build in order: Providers/Doctor → Overview → Provider Detail → History → Settings/Alerts → optional Usage. Implement keyboard navigation, focus, empty/429/stale states. Use images as **layout inspiration** after reviewing gallery QA; do not treat fiction as API data.
- [ ] Menu-bar/Dynamic Island Kunkun surfaces stay thin presentations of data; no separate quota parsing or second provider child process for each UI surface.

**Milestone F — optional Kunkun cloud / research (DO NOT IMPLEMENT before HK signoff):**

- [ ] Prepare a detailed approval request for private cloud vs research, consent flows, retention/deletion/attack model. Only on approval: local batch per device/hour → auth Worker endpoint → one combined D1 hot row per batch (14 days) → R2 immutable per-user/day gzip JSONL archive + verified SHA/checkpoint + crash-safe delete after grace. No remote JSONL append; never delete D1 source without verified archive restore.
- [ ] Public opt-in research: **separate sanitized derived dataset**, day buckets, provider/plan/window cohorts, k≥50 publication threshold, model mix adjustments, revocation policy; aggregate daily into D1. Introduce ephemeral DuckDB/Parquet only at measured need, not a permanent OLAP server. External API/MCP user access requires auth/rate-limit/data partition and privacy review.
- [ ] Paid cloud features may be packaged inside Kunkun; **do not make privacy a paid entitlement**. Don't implement a server-side vendor OAuth harvester.

### 4. Tests, definitions and hard failure cases

For every subtask: (1) write failing fixture test; (2) run targeted red; (3) minimal implementation; (4) targeted green; (5) `bun run test`, `bun run typecheck`, `bun run check`, `bun run build` **fresh**; (6) review `git diff --check`, `git status --short`; (7) update `docs/implementation-status-2026-11-06.md`, `HANDOFF.md` and related plan checkboxes **with evidence**; (8) commit only scoped files after verifying safe state, **no push**.

Essential scenario matrix:

| Scenario                                             | Expected                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| 55% used at 3.5/7d fixed                             | Ideal 50% used (or 50% remaining on reversed bar); +5pp ahead                |
| Unknown start, rolling 5h, first-use unproven        | No white tick or fixed-window ETA                                            |
| `fetchedAt` repeated across collection attempts      | One history event, not multiple hourly increments                            |
| Two simultaneous appenders, crash mid-write, restart | Complete lines only; never drop verified records; idempotent safe recovery   |
| Browser/CLI captures source 429 / login missing      | Known stale quota and coded error; no fake zero, no silent auth              |
| Multiple accounts / device overlap                   | Never merge unknown accounts; cloud dedup is user-scoped and authorized      |
| Reset during history                                 | Split window epoch, recompute slope; never interpret rolling refill as reset |
| 1h burst then days idle                              | Low confidence / range / no precise ETA, not exaggerated certainty           |
| No model-token source                                | Cost/model screen shows unavailable, no invented token data                  |
| Research OFF / cloud sync ON or vice versa           | Opt-in settings operate independently; no covert flow                        |
| Cohort <50 or differencing risk                      | Suppress aggregate and query response                                        |

### 5. Output after each milestone

Send HK a concise engineering report in Chinese:

1. Which exact milestone(s) and tasks were done, with code file paths and commit SHA if any.
2. Test table (targeted, full tests count, typecheck, check, build, real provider smoke: verified/failed/not run), and last `git status`.
3. Screenshot/video of _actual_ TUI/UI when available, clearly distinct from concept art.
4. Changed data contracts, security and privacy risks, provider API version issues.
5. Next prioritized unchecked tasks, prerequisites, and decisions requiring HK's approval.
6. Update local HANDOFF and Google Drive/Notion documentation with **exact links** if connected tooling is available; if unavailable, make the local Markdown authoritative and report missing sync without inventing a link.

Do **not** ask HK to decide trivial implementation details; follow the written product spec and make the smallest safe incremental choice. Stop and request approval only for external writes/deployment, credential/Keychain access, paid cloud infrastructure, publishing, or major deviations from core stack or data-privacy defaults.

Start now with inspection and a one-page status summary. Then implement the first incomplete local milestone in the documented order. No wholesale rewrite.

## PROMPT END
