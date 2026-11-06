# Kuota — shadcn Dashboard & Kunkun Concept Gallery

> **DESIGN / HANDOFF, not screenshots of running software.** 2026-11-06. 11 conceptual pages, all available in [Google Drive / projects / kuota / Design / Concepts](https://drive.google.com/drive/folders/1LndhYb13cKjFijWzclnRwiZ1whEpt4n-).
>
> Source of truth for requirements: [`2026-11-06-kuota-dashboard-ux.md`](../specs/2026-11-06-kuota-dashboard-ux.md). Technical data/API: [`2026-11-06-kuota-history-cloud-spec.md`](../specs/2026-11-06-kuota-history-cloud-spec.md). Implementer: **follow the written spec for math, labels, states and permissions; AI-generated mockup values are illustrative only.**

## 1. Gallery index and implementation mapping

| #   | Route / surface                   | Image (Google Drive)                                                                                  | Main task + user stories                                                                | Reusable UI components                                                  | Priority |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------- |
| 01  | Overview `/`                      | [01-overview.png](https://drive.google.com/file/d/1bblg7F4egw9Oj4jrbWamw7FVFCJxq0_l/view)             | Compare distinct provider windows; white ideal marker; risks / next reset — US-01/02/13 | `Sidebar`, `Card`, `Badge`, `Tabs`, custom `PacedProgress`, `Tooltip`   | P0       |
| 02  | History `/history`                | [02-history-forecast.png](https://drive.google.com/file/d/15JHTsC-MjI4qdJFnzCTmdjO3oEnYsg1c/view)     | Observations vs projected pace, window selector, confidence, reset — US-03/04/05        | `ChartContainer`, `AreaChart`, `ReferenceLine`, `DatePicker`, `Select`  | P1       |
| 03  | Provider detail `/providers/:id`  | [03-provider-detail.png](https://drive.google.com/file/d/1Ztaa6zvHv3NwSW0GGRcmuOhcH1ycRKTS/view)      | Independent 5h/weekly/model windows, provenance inspector — US-07                       | `Breadcrumb`, `Tabs`, `DataTable`, `Sheet`, `PacedProgress`             | P1       |
| 04  | Provider connections `/providers` | [04-provider-connections.png](https://drive.google.com/file/d/1T5gMxhyuOXtkza3054IIu3ZOGQYNReOx/view) | Which adapters actually work, diagnostics, missing auth — US-01/13                      | `DataTable`, `Badge`, `Sheet`, `Alert`, `Skeleton`                      | P0       |
| 05  | Usage & Value `/usage`            | [05-usage-value.png](https://drive.google.com/file/d/1PqmAtFz0gDTXP0Fu52vLeZ0fgDxvQASg/view)          | Model token/caching statistics; estimated API value ≠ vendor bill — US-06               | `AreaChart`, `BarChart`, `DataTable`, `Card`                            | P2       |
| 06  | Projects `/projects`              | [06-projects-activity.png](https://drive.google.com/file/d/1gePZIR0NQ6-rw4AIjH6sGVjh1ryiVYqa/view)    | Separate opt-in activity signals, no hours inferred from quota — US-08                  | `Heatmap` custom, `Table`, `Switch`, `AlertDialog`                      | Future   |
| 07  | Benchmarks `/benchmarks`          | [07-community-benchmarks.png](https://drive.google.com/file/d/1eYMbhSeuApkLBAkPY73KpmlZIYOVpya5/view) | Aggregated opt-in cohort, k suppression, uncertainty — US-09                            | `Select`, `BoxPlot` custom/Recharts, `Card`, `Alert`                    | Future   |
| 08  | Data & Sync `/data`               | [08-data-sync-privacy.png](https://drive.google.com/file/d/1_-8e5qGd3dSU6CERLG7RW3K8Kl0MErsx/view)    | Local-only baseline + private sync + separate research consent — US-10/14               | `Switch`, `RadioGroup`, `AlertDialog`, `Accordion`, `CodeBlock`         | P2       |
| 09  | Alerts `/alerts`                  | [09-alerts-automation.png](https://drive.google.com/file/d/19i4_kySlfhYzbqlFPBbYsiMbK6xbinmK/view)    | Threshold and forecast rules, notification preview, cooldown — US-11                    | `DataTable`, `Sheet`, `Select`, `Input`, `Sonner`                       | P2       |
| 10  | Settings `/settings`              | [10-settings-scheduler.png](https://drive.google.com/file/d/1T1GvA3wrOVEnnjYYH5IUNsAZc-FMX0Gq/view)   | Adaptive local scheduling, provider TTL, privacy, theme — US-05/10/13                   | `Tabs`, `RadioGroup`, `Switch`, `Select`                                | P1       |
| 11  | Compact launcher + island         | [11-kunkun-island.png](https://drive.google.com/file/d/1G6YCbLzgN0u2xLQ_BNjCUvR-gJAjAOLB/view)        | Kunkun palette preview + menu-bar glance; distinct windows — US-01/02                   | Kunkun `Command`/preview, compact `Card`/`Progress`; native host bridge | Future   |

**Sidebar IA:** Overview → Providers → History & Forecast → Usage & Value → Projects → Benchmarks → Alerts → Data & Sync → Settings. Provider Detail is nested under Providers. Screens are different routes, not different applications. Kunkun compact is an alternate surface of the same data contract.

## 2. Product logic all screens MUST implement

### 2.1 What a quota progress bar actually means

- `usedPercent` = observed vendor-used percentage; `remainingPercent = 100 - usedPercent` only if measured. Percentages never aggregate across providers/accounts/windows.
- **Exactly one white tick per window**: ideal linear elapsed-time progress when **start and reset/end are reliably known** and window semantics are compatible with a fixed cycle. On a _used_ bar position = `idealUsedPercent`; on a _remaining_ bar position = `idealRemainingPercent`.
- The tick is **not** a projection; show text `Ideal at this point: 50%` and tooltip explaining known/inferred boundary. A rolling refill, unknown start or expired window must not display a guessed tick.
- **Forecast** is a separate dashed/amber line requiring at least 2 comparable distinct observed readings; use `insufficient/low/medium/high/unsupported`, not a fake 72% statistical probability. Explicit `exhaustedAt`/`on pace` / `no estimate` with reset comparator.
- All timestamps: UTC ISO in API, user's local timezone in UI with explicit tooltip; `last fetched` age distinct from `last collected`. Every chart states provider, account only when proven, window, metric and window boundary.

### 2.2 Empty, error, security and future states

| Condition                  | Correct UX                                                             | Wrong UX                                        |
| -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| Claude logged out          | `Sign in required` + steps / no background login                       | `0% left` or fake OAuth button                  |
| agy account unverified     | `Account not verified`, per-device only, no cross-device join          | Guessed email / combining accounts              |
| Provider 429               | Last trusted reading is **stale**, backoff/cooldown info               | Rapid retries, bypassing rate limit             |
| Only 1 history point       | `Collecting history; ETA unavailable`                                  | Precise exhaustion date                         |
| Rolling 5h window          | No fixed ideal marker until semantics proven; no fixed-window forecast | Time-percent tick extrapolated from reset alone |
| No token telemetry         | `Token details not reported by this adapter`                           | Project/model/cost figures invented             |
| Project activity OFF       | Empty state with separate consent and data-source description          | Generated work hours from quota snapshots       |
| Community contribution OFF | No research upload; still fully usable local app                       | Paid privacy paywall / silent sharing           |
| Private sync OFF           | No network send; local export/retention still work                     | Dashboard implying private history is on server |
| Research cohort <50        | `Suppressed: insufficient sample size`                                 | Individual rows, re-identifiable distributions  |

### 2.3 App/page flow

1. **First use:** Detect installed provider adapters without auto-login; show available and error states; optionally ask `Enable local history?` (default OFF until user chooses persistence).
2. **Overview:** Show most relevant _independent_ provider windows and source freshness; click a card to Provider Detail.
3. **Collect:** `kuota collect --once --json` records actual non-stale snapshots into local JSONL using deduplicated IDs; no cloud upload. Scheduler is opt-in and respects backoff.
4. **History:** Filter by provider → account if verified → window → epoch → time; no merging across resets; calculate forecast with caveats. Right pane can show sample count/observed span/source trust.
5. **Plan:** Alert rules can use observed remaining thresholds immediately; forecast-driven rules only when forecast quality meets threshold; no sensitive token inclusion in notifications.
6. **Optional cloud:** Private history opt-in can sync from local producer to per-user server; research opt-in independently sends only a reviewed coarse-grained aggregate payload. User can export/delete/revoke, and private cloud access cannot be inferred from research participation.
7. **Compact surfaces:** Kunkun panel and menu-bar/island display max 2–3 pinned provider-window rows; tapping opens details, no independent quota calculation logic.

## 3. shadcn component design tokens & responsive behavior

- React 19 + Tailwind CSS v4 design variables, Radix / shadcn; background `#09090b`, card `#111113`, border `#27272a`, foreground `#fafafa`, muted `#a1a1aa`, high-density 14px text and 12px labels. Subtle rings, single purposeful accent, 12px card radius, 8px spacing steps.
- Nav: [shadcn Sidebar](https://ui.shadcn.com/docs/components/sidebar), [Breadcrumb](https://ui.shadcn.com/docs/components/breadcrumb), [Command](https://ui.shadcn.com/docs/components/command). Keyboard `Cmd+K`, `1/2/3` TUI only unless focus permits, proper Esc return.
- Charts: [shadcn Chart](https://ui.shadcn.com/charts) / Recharts composed with `ReferenceLine` at 100% used and reset, `Line` solid measured and dashed model projection; avoid using a single series that suggests forecast data is measured.
- Tabular data: TanStack Table / [shadcn Data Table](https://ui.shadcn.com/docs/components/data-table); use [Shadcn Studio DataTable Grouping](https://shadcnstudio.com/blocks/datatable/datatable-grouping) **only after checking Free/Pro license**.
- Controls: `Select`, `Tabs`, `RadioGroup`, `Switch`, `Sheet`/`Drawer`, `AlertDialog`, `Skeleton`, `Sonner`. Use standard control behaviors; previews must not secretly enable data collection.
- 1440px: full sidebar, multi-column content. 1024px: collapsed nav, max 2 columns. 768px: single-chart, stacked cards. 420px launcher: 1–3 pinned rows with a white tick but no full-width analytical chart.
- Accessibility: visible focus, keyboard drill-down, readable `aria-valuenow` for _measured_ percent, separate accessible explanation for ideal marker, safe color contrast, prefers-reduced-motion; don't encode status in color alone.
- Same `QuotaSnapshot`/History/Forecast versioned library types drive CLI JSON, UniView, Kunkun and browser; do not recalculate percentages in React and risk divergence.

## 4. Image QA — corrections REQUIRED before pixel-accurate implementation

AI-generated screenshots are **not exact technical specifications**. These defects are known and must be corrected in the actual UI:

1. `02-history-forecast.png`: generated copy partly conflates a rolling window with fixed-cycle forecasting. Show `unsupported` for genuinely rolling windows, or replace the label with a confirmed fixed weekly window; never show both states simultaneously.
2. `03-provider-detail.png`: mock numbers `20,000 requests` and provider `API (Live)` are illustration-only; existing Claude reader exposes percent windows, not a verified request cap. Remove the invented request denominator and absolute counts unless a real adapter reports them. Image's “72% confidence” is also **not calibrated**; use a named confidence level.
3. `04-provider-connections.png`: dates/diagnostic claims are fictional, not live Mac mini state; reader implementation source and capabilities must be proven. Add a distinct `status:unauthenticated` and `rate_limited` test fixture.
4. `05-usage-value.png`: mixing model families under one provider is fictional; the model table must reflect actual attributed telemetry with data provenance, or display an empty state. “API-equivalent value” is not a payment invoice.
5. `06-projects-activity.png`: activity heatmap and project totals require explicit opt-in hooks. Remove any project name/path cloud sharing switch until a separate purpose and consent is designed. Git commits alone do **not** equal active coding hours.
6. `07-community-benchmarks.png`: effective token allowance cannot be presented as a precise official cap; hide cohort data until opt-in, k-suppression, normalization and bias/backtests are proven.
7. `08-data-sync-privacy.png`: the mock shows both “30d retention” and “90 days”; choose one backed by saved setting. The line from private cloud to research must **not imply that research depends on private sync**; implement two separate independent channels from local storage, neither preenabled. Don't claim cloud encryption until actually implemented.
8. `09-alerts-automation.png`: example rules and notification statuses are future design only; do not imply that background OS notifications currently exist.
9. `10-settings-scheduler.png`: `Kunkun scheduler` and macOS launchd controls are future integration proposals; use disabled/`not configured` states until verified. Avoid conflicts between in-process TUI refresh and OS scheduler.
10. `11-kunkun-island.png`: generator drew **multiple** white ticks per row. Correct to **one** white ideal pace marker maximum (or none when unavailable), and distinguish actual native menu-bar affordances from a Mac's unsupported Dynamic Island geometry.
11. Any mock showing exact names, dates, counts, price figures or ratios is **fictional**. Never read it as a provider API format, or copy private user identifiers into fixtures.

## 5. Milestone ownership, completion checks and future component inventory

| Stage                   | Release surfaces                                       | Acceptance evidence                                                                                           |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| H1 — pure pace          | `@kuota/core`; CLI planned                             | Fixed math with strict source semantics; 13 tests currently pass                                              |
| H2 — local history      | `@kuota/core` + separate `@kuota/history` + Effect CLI | JSONL crash-safe append, idempotence, no credentials, error events, export                                    |
| H3 — forecast           | Pure core + CLI                                        | Independent epochs; no false rolling ETA; snapshots older than actual fetch don't create false deltas         |
| H4 — UniView            | TUI                                                    | Proper compact status, pinned windows, white tick with text legend; real TTY manual QA                        |
| H5 — Kunkun React       | Sidebar routes 01–05, 09–10 first                      | Kunkun v2.1 broker verified, permissions, keyboard, loaders/errors; cloud-free local data works               |
| H6 — private cloud      | Data/Sync 08, extended History 02                      | User auth, immutable R2 archive, D1 hot 14d, export/delete, disaster-recovery drill, private opt-in           |
| H7 — aggregate research | Benchmarks 07                                          | k≥50, consent/version and cohort suppression, no raw user traces in public API; no forced free-tier telemetry |
| H8 — activity           | Projects 06                                            | Separate source permission and activity time definitions; project names local by default                      |

**Implementation prompt:** [`docs/handoff/2026-11-06-kuota-ai-implementation-prompt.md`](../handoff/2026-11-06-kuota-ai-implementation-prompt.md). Do not attempt all 11 UIs in a single coding task; work in tested vertical slices, preserving the current v1 CLI contract.
