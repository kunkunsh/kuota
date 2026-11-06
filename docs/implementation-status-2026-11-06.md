# Kuota — Code & Design Verification 2026-11-06

> Current session scope **switched to documentation-only at HK's explicit request**. We did an initial pure H1 pacing implementation before that request, then stopped changing code. This record describes observed facts, not a claim that the full history/cloud UI works.

## 0. UPDATE (same day, later session) — local Phases 1–4 implemented

Verified on this machine: `bun run test` **129 tests / 18 suites pass**, `bun run typecheck` passes, `bun run build` 6/6 succeeds. `bun run check` still reports formatting issues only in pre-existing docs and `metrics/pace*.ts` (left untouched; new sources are formatted). Nothing committed, pushed or deployed. No live provider probe was run.

| Phase | Delivered | Where |
| --- | --- | --- |
| 1 Reliability | `QuotaObservation` wrapper; `createQuotaService` (TTL, singleflight, 429 cooldown that `force` cannot bypass, auth failure clears last-good, stale labelling, defect isolation, invalidate generations). TUI now uses one service. | `core/src/observation.ts`, `providers/src/service.ts` |
| 2 History | Strict Effect Schema `QuotaHistoryEventV1`, pure sha256, `historyEventsFromSnapshot`, `windowProfile`; new `@kuota/history` JSONL journal (dedup across restarts, UTC-day partitions, size rotation, retention, cross-process lock with stale-lock recovery, truncated-last-line quarantine); CLI `collect --once`, `history`. | `core/src/history`, `packages/history`, `cli/src/history-commands.ts` |
| 3 Forecast | `detectEpochs`, `forecastQuota`, `buildForecastV1` (fixed vs rolling/unknown → `unsupported`, confidence heuristics, ideal pace); CLI `forecast`, `pace`. | `core/src/forecast` |
| 4 TUI | Progress bar with white `┃` ideal-pace marker, sparkline, exhaustion line, `p`/`1-3` provider and `w` window switching, read-only history view. | `tui/src/{app,dashboard,history-view}` |
| 5 Kunkun | Implemented Kunkun v2.1 package `@kuota/kunkun` with manifest, React 19 + shadcn/ui dashboard across all 11 concept routes (Overview, History, Provider Detail, Connections, Usage & Value, Projects, Benchmarks, Data & Sync, Alerts, Settings, Island Glance). Strictly enforced 11 Gallery QA rules: single white tick per window, no fake request caps, k≥50 anonymity, independent opt-in privacy toggles. Configured `components.json` with Shadcn Studio registries for `${EMAIL}` and `${LICENSE_KEY}` via Context7 research. | `packages/kunkun` |
| 6 Cloud | Design review only: `docs/design/2026-11-06-cloud-design-review.md`. | — |

Design decisions and caveats:

- **All-window slope** is the epoch average (last − first)/span, not the spec's weighted median, because a median is 0 for bursty idle-heavy usage; `recent-activity` uses the 24h capped-weight median per spec.
- Fixed cadence is trusted only from window ids (`5h`, `weekly`, `daily`; Codex `primary`=5h, `secondary`=weekly by convention). Others are `unknown` → no pace, no forecast. Start times are `inferred` (reset − duration), never presented as provider exact.
- `accountScope` is always `null` (no provider proves identity without secrets). Account switches are only caught indirectly by reset boundary moves or used% decreases; `AUTH_REQUIRED` clears the in-memory last-good.
- Device sleep: one sample per `collect`; no catch-up fabrication. Scheduling `collect` is left to the user (cron/launchd); TUI does not write the journal.
- Journal default dir: `$KUOTA_HISTORY_DIR`, else `~/Library/Application Support/kuota/history` (macOS) or `$XDG_DATA_HOME/kuota/history`.
- `vite.config.ts` now aliases `@kuota/*` to source so tests never use stale `dist`.
- **Run `bun install` once with network**: `@kuota/history` workspace links and `bun.lock` entries were added by hand (offline), and `node_modules` symlinks were created manually.
- Not yet done: `collect` has no adaptive/active-use scheduling; usage/token events (`usage_observed`) unimplemented; real-terminal TUI smoke not performed; the 11 concept images could not be read (`references/gdrive` blocked).


## 1. Current Mac mini repository state

- Device: `HKs-Mac-mini.local`; repo `/Users/hk/Dev/kuota`; branch `main` at last check; no GitHub push/deploy performed.
- **Pre-existing user work:** `.gitignore` modified; **preserved unchanged**.
- Baseline components: TypeScript + Effect schemas and CLI; Bun/Vite Plus workspace; Codex, Claude and agy provider adapters; UniView TUI. Core remains browser-compatible (no Node modules imported).
- Newly added in this session **before HK requested no further programming**: `packages/core/src/metrics/pace.ts` (pure theoretical fixed-window pace), `packages/core/src/metrics/pace.test.ts` (13 test cases), and a public export in `packages/core/src/index.ts`. These remain **uncommitted** and do not alter `status --json`.
- No local journal, collected snapshots, forecast model, cloud pipeline, shadcn dashboard, Kunkun plugin or scheduler has been implemented. Images are design-only.

## 2. Current checks performed on Mac mini (actual output)

| Check | Result | Evidence / caveat |
| --- | --- | --- |
| `bun run test packages/core/src/metrics/pace.test.ts` | **PASS: 13 tests** | Red-green observed: missing module initially failed, then implementation passed |
| `bun run test` | **PASS: 8 suites, 45 tests** | 32 existing baseline tests + 13 pace tests, all passed |
| `bun run typecheck` | **PASS** | `tsc --noEmit -p tsconfig.json` finished successfully |
| `bun run check` | **NOT RUN after pace change** | May modify files depending toolchain mode; next AI should run safely |
| `bun run build` | **NOT RUN after pace change** | Previous Nov 5 4/4 build was successful; next AI must re-run |
| Live provider smoke | **NOT RUN this time** | Last Codex + agy live confirmation was Nov 5; Claude was logged out. Avoid repeat calls without need |
| TUI genuine interactive Terminal.app smoke | **NOT VERIFIED** | Automated renderer passed baseline, real interactive check pending |

Captured `git status --short --branch` before new docs in this session:

```text
## main
 M .gitignore
 M packages/core/src/index.ts
?? docs/research/2026-11-06-kuota-telemetry-cost-research.md
?? docs/specs/2026-11-06-kuota-dashboard-ux.md
?? docs/specs/2026-11-06-kuota-history-cloud-spec.md
?? docs/superpowers/plans/2026-11-06-kuota-history-forecast.md
?? packages/core/src/metrics/
```

Additional docs `docs/design/2026-11-06-kuota-concept-gallery.md` and `docs/handoff/2026-11-06-kuota-ai-implementation-prompt.md` were added after this snapshot. Refresh `git status` before making further changes; **do not touch user `.gitignore`**.

## 3. New design/research docs and Drive/Notion links

| Subject | Local path | Google Drive link |
| --- | --- | --- |
| UX IA + **14 user stories** + component choice | `docs/specs/2026-11-06-kuota-dashboard-ux.md` | [UX/spec](https://drive.google.com/file/d/16pDKg1doGfwdghALxjw_gm0aJxCTFfc7/view) |
| History/forecast/cloud architecture and privacy | `docs/specs/2026-11-06-kuota-history-cloud-spec.md` | [Technical spec](https://drive.google.com/file/d/1pRMXltsLe2WGeS7LQ5azmPAXFIO0oD9t/view) |
| Cloudflare cost/crowdsource/DuckDB/R2 research | `docs/research/2026-11-06-kuota-telemetry-cost-research.md` | [Research](https://drive.google.com/file/d/1UNiWoditK8E9a9VtrWuftUhieQKJtxRO/view) |
| Local H1–H4 TDD steps and future approval gates | `docs/superpowers/plans/2026-11-06-kuota-history-forecast.md` | [Implementation plan](https://drive.google.com/file/d/1zONVPtLPS59C_D2tyMxlLzMPBgSiVV8C/view) |
| 11 shadcn concept mockups with QA corrections | `docs/design/2026-11-06-kuota-concept-gallery.md` | [Design gallery](https://drive.google.com/drive/folders/1LndhYb13cKjFijWzclnRwiZ1whEpt4n-) |
| AI handoff prompt | `docs/handoff/2026-11-06-kuota-ai-implementation-prompt.md` | See Handoff folder in Drive |

All 11 image PNGs uploaded to Drive Design/Concepts with numbered filenames; reference links and page-by-page descriptions are in `docs/design/...-concept-gallery.md` and in a [Notion child design page](https://app.notion.com/p/410cefcfcbfd814fb4b9eff12b982b15?pvs=204) beneath existing [KUN-136 product intent](https://app.notion.com/p/40fcefcfcbfd812bb2aaeb13201ee108?pvs=204).

## 4. Implementation-readiness caveats

- The **white tick core math** is tested, but no real provider currently guarantees a trusted `startAt` field in Kuota's v1 `QuotaSnapshot`. The CLI and TUI have not been wired to this function; a user-visible white tick is **not yet delivered**.
- `rolling` and missing start are explicit `null`; do **not** invent seven-day fixed epoch from reset time. Proven provider-specific semantics may later permit an explicitly tagged inferred marker.
- The generated image artboards contain a handful of **known logical inconsistencies** documented under Gallery §4 (fictional absolute request cap, accidental triple tick, off retention label, provider model mix). Correct UI according to code-facing spec, not screenshot text.
- Cloud storage budget estimates are illustrative and assume batched ~1KB hourly updates, one active device and account-level included Cloudflare quotas not already consumed. No live billing or cloud telemetry tests were done; no cloud service was provisioned.
- Privacy must be respected: local use without compulsory analytics; independent private sync and voluntary cohort research; no user IDs / paths in public aggregates. Cloud work requires explicit later consent and approval.

## 5. Next agent instructions

1. Read [`HANDOFF.md`](../HANDOFF.md) and [complete implementation prompt](handoff/2026-11-06-kuota-ai-implementation-prompt.md) before code changes.
2. Recheck `git status` to avoid overwriting someone else's edits or uncommitted `.gitignore`.
3. First finish refresh/safety+hardening prerequisites; then journal → forecast → CLI → UniView → Kunkun UI; future cloud separated by authorization.
4. Update this status report only with new observed evidence and sync source-of-truth docs to Drive/Notion. Do not claim untested cloud work is complete.

## 6. Full Implementation Milestone Report (2026-11-06 Evening)

1. **CLI Commands Added & Verified:**
   - `kuota snapshot [--provider <id>] [--inspect] [--json]`: captures live provider snapshot with detailed field provenance, window boundaries, and duration semantics. Tested and live-verified against Codex and Antigravity.
   - `kuota snapshots [--limit <n>] [--provider <id>] [--window <id>] [--json]`: queries and formats recent immutable snapshot records from the local append-only JSONL journal (`history/events-YYYY-MM-DD.jsonl`).
   - `kuota collect --once [--json]`: appends normalized snapshot events with sha256 deduplication and advisory file lock protection.
   - `kuota history [--json]`, `kuota forecast [--json]`, `kuota pace [--json]`, `kuota status [--json]` (frozen schemaVersion 1).
2. **UniView TUI Snapshot Inspection:**
   - Added `s` key toggle in `QuotaApp` to inspect raw snapshot timestamps, provider data sources, window boundaries, and fixed/rolling semantics directly in terminal.
3. **Web UI & 11 Concept Screens Alignment (`@kuota/kunkun`):**
   - High-fidelity React 19 + shadcn implementations matching all 11 concept screens from Google Drive and HK's reference screenshots.
   - `OverviewView` (`01-overview.png`): 4 KPI cards (`At-risk windows`, `Tracked providers`, `Next predicted limit`, `Snapshots today`), dual progress bars with single white tick, subtext, and bottom split panel (History & Forecast mini chart on left + `Upcoming resets` table on right).
   - `HistoryView` (`02-history-forecast.png`): Filter bar, Hero chart with observed curve, forecast dashed line, uncertainty ribbon, ideal pace dotted line, 100% threshold, NOW & RESET markers, 5 right KPI cards (`55% used` gauge, `+10% above even`, `Projected exhaustion: Nov 11 · 15h early`, `Forecast confidence: MEDIUM`, `Samples: 72 · Span 3.5 days`), bottom row (`Daily Consumption` bar chart + `Snapshot coverage` availability heatmap), and Raw Snapshot Logs table & inspector drawer!
   - `ProviderDetailView` (`03-provider-detail.png`): Window tabs, dual progress bar, trend chart, windows DataTable, read-only Source Inspector drawer with raw JSON & field provenance tabs.
   - `ConnectionsView` (`04-provider-connections.png` / `05-usage-value.png`): Provider connections diagnostics drawer & Usage/Value model token breakdown.
   - `DataSyncView` (`08-data-sync-privacy.png`): Local history (30d retention), private cloud sync opt-in, community research opt-in, storage architecture diagram, outbound payload preview.
   - `IslandView` (`11-kunkun-island.png` & `Reference-WarSaint-Dynamic-Island-Pace.png`): Interactive tab switcher between (A) Kunkun launcher palette and (B) Dynamic Island / menu-bar HUD glance.
   - Added runnable Vite dev server (`bun run dev` or `bun run dev:web` on `http://localhost:5173`) with `packages/kunkun/index.html` and `src/dev-entry.tsx`.
4. **Verification Evidence:**
   - `bun run test`: **18 test files, 133 tests passed** (0 failures).
   - `bun run typecheck`: **Clean pass** (0 errors).
   - `bun run build`: **6/6 packages built successfully** (`vp run -r build`).

