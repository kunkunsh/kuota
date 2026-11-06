# Kuota Dashboard & Kunkun Plugin — UX / Information Architecture v1

> Date: 2026-11-06 · Status: **DESIGN ONLY — not implemented** · Owner: HK  
> Main product: Kuota (standalone TypeScript library, Effect CLI, UniView TUI); optional future Kunkun React plugin and web/cloud dashboard.  
> Design reference: [WarSaint quota island screenshot supplied by HK](https://github.com/steipete/CodexBar), [OpenCode Go usage example](https://opencode.ai/), [shadcn/ui](https://ui.shadcn.com/), [Shadcn Studio](https://shadcnstudio.com/).

## 0. Design decisions (read before implementation)

1. **Separate actual quota, time budget and forecast.** Provider quota percentages are the actual source; the white vertical marker represents _ideal time-based pace_; a dashed forecast is explicitly a statistical estimate. Never render inferred quota as an observed fact.
2. **No cross-provider percentage.** Codex 60% remaining and Claude 45% remaining cannot be combined into meaningful global "52.5% remaining." Overview is a _collection of independently labeled windows_.
3. **One window at a time for deep analysis.** A provider may have five-hour, weekly, monthly, model-family, extra-credit or rolling windows. Every chart names the provider, account, metric, window, currency/units, freshness and next reset.
4. **Dark shadcn baseline.** React 19, Tailwind CSS design tokens (`background`, `card`, `muted`, `foreground`, `primary`, `destructive`, `border`, `ring`), 12px radii, normal thin borders, compact tables, optional subtle motion. Do not make a flashy analytics landing page.
5. **Local-first and credible privacy.** No account required for local tracking. **Cloud sync and crowdsourced research are separate choices**; unconsented metrics never leave the device. A paid plan does not become the only way to keep data private.
6. **Provider support is honest.** The existing Kuota baseline has live-tested Codex and agy, fixture-tested Claude; no assumption that OpenCode Go, Gemini, GLM, Cursor, etc. have working adapters yet.
7. **Same model, many surfaces.** `@kuota/core` supplies types and pure calculations; Effect CLI JSON, UniView TUI, Kunkun panel, Dynamic Island / menu bar and browser share the same contract; no reverse parsing HTML for data.

## 1. Persona + user stories with acceptance criteria

### US-01 — I want to know if I can keep coding tonight (P0)

**As** a developer running Claude and Codex concurrently, **I want** a compact remaining quota for every active time window and its reset time, **so** I can switch provider before hitting a limit.  
**When:** My Kunkun launcher opens, CLI runs `kuota status --json`, or TUI shows the panel.  
**Acceptance:** A window card always shows provider + window; known 0% remaining is different from unknown; a failed provider does not blank the others; "last updated" and source/error are visible.

### US-02 — I want a fair-pace reference (P0)

**As** a heavy coding subscriber, **I want** a narrow white tick on the progress bar indicating where my consumption _should_ be if uniformly distributed over the window, **so** I can see instantly whether I am ahead of schedule.  
**Acceptance:** Known window start and end yield exactly one tick; progress left/right semantics are clear; `unknown` / `rolling` / `reset not known` hides the tick with an explanation; no forecast data is required.

### US-03 — I want to know the likely exhaustion date (P1)

**As** a subscriber, **I want** a trend line and projected date for exhausting the limit, **so** I can decide whether to slow down, buy another plan or schedule tasks differently.  
**Acceptance:** Observed data is solid green/blue; forecast is dashed amber; 100% threshold and reset event labeled; confidence is `low/medium/high/insufficient`; no valid slope means "Not enough data", never a fabricated date.

### US-04 — I want forecasts that understand work bursts (P2)

**As** an engineer who works 10h intensely then sleeps, **I want** "recent pace" and "all-window pace" to differ, **so** a one-hour burst does not falsely imply imminent depletion.  
**Acceptance:** Show current estimate, 7d/all-window baseline where possible, mode selector, and a wide uncertainty range for sparse data; do not train through quota resets.

### US-05 — I want a longitudinal data record (P1)

**As** a user with multiple machines, **I want** low-overhead local snapshots at configurable intervals, **so** I can compare usage now versus last week.  
**Acceptance:** A one-shot scheduler runs when OS permits, append is idempotent, sleepers/missed runs are gaps rather than synthetic measurements, retention and export work without Kunkun Cloud.

### US-06 — I want to distinguish subscription usage from API value (P2)

**As** a power user, **I want** an approximate API-equivalent spend graph and cache ratio, **so** I can understand value without confusing it with the paid invoice.  
**Acceptance:** Data source and pricing model displayed; `estimated` badges for local calculations; never label it vendor-verified bill, quota cap, or official cost.

### US-07 — I want provider-specific detail (P1)

**As** a user with agy Gemini weekly/5h and Codex weekly windows, **I want** to drill down, **so** provider-specific limits do not get averaged away.  
**Acceptance:** Provider detail lists all windows, model families, data freshness, observations, reset semantics, source and error states; one route can be deep-linked.

### US-08 — I want a project time report (Future, separate consent)

**As** a WakaTime user, **I want** AI time, model usage and estimated token cost grouped by repo, **so** I can see which projects consume my attention.  
**Acceptance:** Explicit local activity collection switch; default no file path/content upload; project names can be local-only or manually aliased; browser dashboard never guesses "worked hours" from AI quota snapshots alone.

### US-09 — I want an industry benchmark without exposing secrets (Future)

**As** a researcher, **I want** opt-in aggregate provider/plan statistics and potential allowance changes, **so** I can compare plans.  
**Acceptance:** Cohorts below k=30 (prefer 50) are suppressed; no account ID, project name, repo path, exact timestamp, token or device identifiers in published aggregate; sample count, time range, uncertainty and model mix are shown.

### US-10 — I want to choose exactly what is shared (P2)

**As** a privacy-conscious user, **I want** local-only, private cloud sync and independent research contribution controls, **so** I can benefit from Kuota without disclosing behavioral data.  
**Acceptance:** Cloud sync opt-in and research sharing opt-in independently, with preview of payload, export and delete options; no pre-ticked research consent.

### US-11 — I want warnings before exhaustion (P1/P2)

**As** a user who runs agents overnight, **I want** configurable thresholds and forecast ETA warnings, **so** I can switch providers or pause jobs.  
**Acceptance:** Alert is window-scoped, rate-limited, no duplicate alert on cached snapshot, includes confidence, never silently starts a background login.

### US-12 — I want machine-readable data (P1)

**As** a CLI/agent user, **I want** versioned `kuota history --json` and `kuota forecast --json` (future MCP/HTTP endpoint), **so** I can schedule work or view metrics in Kunkun.  
**Acceptance:** `status --json` v1 is unchanged; new commands clearly separate measurement from inference, use UTC ISO timestamps and sanitized error codes; no prompts/auth flows inside JSON commands.

### US-13 — I am logged out or a provider has no quota endpoint (P0)

**As** a user, **I want** a non-alarming clear empty state and manual remedy, **so** I do not mistake missing quota for zero remaining.  
**Acceptance:** Provider card says `Sign in required`, `Rate limited`, `Not supported` or `No observations`; no fake zero or forecast.

### US-14 — I change Mac or reinstall Kunkun (P2)

**As** a user, **I want** to import/export local history and optional private sync, **so** my prior observations survive reinstall.  
**Acceptance:** Local JSONL can export; cloud private history remains partitioned by user; account and device dedup prevents double counts.

## 2. Navigation and page map

Primary sidebar: `Overview` → `Providers` → `History & Forecast` → `Usage & Value` → `Projects` (Future / opt-in) → `Community Benchmarks` (Future) → `Alerts` → `Data & Sync` → `Settings`.  
Top bar: project name, device + cloud state, refresh indicator, "last observed", compact account menu.  
Nested routes:

| Page / Route                         | Primary question                  | Data source                               | Actions                                           | Priority |
| ------------------------------------ | --------------------------------- | ----------------------------------------- | ------------------------------------------------- | -------- |
| `Overview /`                         | What should I do now?             | Latest per-window observations + pace     | Refresh, provider click, snooze alert             | P0       |
| `Providers /providers`               | Which integrations work?          | Adapter capability + status               | Doctor, grant, choose account                     | P0       |
| `Provider Detail /providers/:id`     | What are this provider's windows? | One provider + windows + last N events    | Switch window, view source, export                | P1       |
| `History /history?provider=&window=` | How is my pace changing?          | Local 1–90d observations                  | Range, smoothing, projected ETA, export           | P1       |
| `Usage & Value /usage`               | Which model/tokens/cost drivers?  | Local parsed usage events (may be absent) | Model breakdown, cache ratio, estimated pricing   | P2       |
| `Projects /projects`                 | Where did AI time go?             | Optional local project activity           | Consent setup, group by project/model             | Future   |
| `Benchmarks /benchmarks`             | How do similar plans behave?      | Privacy-safe daily cohort aggregates      | Choose provider/plan, view sample and uncertainty | Future   |
| `Alerts /alerts`                     | When will I reach a limit?        | Local forecast + user thresholds          | Add/disable rules, test notification              | P2       |
| `Data & Sync /data`                  | What's stored where?              | Local store, remote status, retention     | Sync, export, delete, consent preview             | P2       |
| `Settings /settings`                 | How should Kuota run?             | Provider settings, sampler, UI prefs      | Interval, startup, network, theme                 | P1       |
| Kunkun compact panel                 | Can I launch a task now?          | Latest + pace/ETA                         | Expand dashboard, provider details                | P1       |
| macOS menu bar / Dynamic Island      | How much is left at glance?       | Latest cached values                      | Open panel, refresh with cooldown                 | Future   |

### Shared invariants across all screens

- A provider has one or more **distinct quota windows**. A plan cost, usage tokens, quota percent and API-equivalent dollar amount are **different metrics**.
- Unit labels are explicit. Never show "unlimited" based on missing quota/100% remaining.
- Observed line = solid; forecast line = dashed; pace tick = 1–2px white; reset = vertical dotted line; error = visible status.
- Offline/cloud disabled still renders local data; read-only web dashboard may show "Waiting for device sync" rather than pretending live.
- "Now" never means real-time if source fetchedAt is old. All pages display freshness.

## 3. Page-specific UX specs

### 3.1 Overview — decision in five seconds

Layout desktop 1440px: sidebar 248px; content max-width 1400px, padding 24px, 12-column grid. Header `Kuota / Overview`, device status, `Last sync 4m ago`, `Refresh all`. Row of 3–4 independent KPI cards: `Next likely exhausted`, `At-risk windows`, `Tracked providers`, `Snapshots in last 24h` (never a combined quota percentage). Then provider cards in 2-column grid. Each card shows logo, account alias only if verified, provider plan, window chip, `45% left`, `resets in 3d 12h`, actual colored progress and white tick, `Slightly above pace`/`Below pace` pill, freshness. Under cards: one _selected_ high-risk window's mini trend and `Upcoming resets` list; activity feed includes probe state, no raw tokens.

Interactions: clicking card opens detail; select quick 5h/weekly tabs **inside card** with keyboard accessible `Tabs`; refresh respects TTL/cooldown; unavailable card placeholder maintains layout; 100% used warning high contrast, not solely color.

### 3.2 Providers — transparent acquisition

Rows for Codex, Claude, Antigravity (implemented at baseline), future rows for OpenCode Go/Gemini/GLM flagged `Planned`. Column: Source, Data type, Installed, Authentication, Last success, Refresh policy, Status. `Doctor` opens Drawer with sanitized test outcomes, available executable paths (avoid sensitive directory disclosure in cloud), and permission requests. Distinguish app-server/CLI/OAuth/browser API; never show fake universal "Connect" OAuth button. Multiple accounts only when identity confirmed; for agy `Account not verified` badge.

### 3.3 Provider detail — all windows without conflation

Breadcrumb Overview > Providers > Claude. Provider header `Claude Code / Max 20x`, last fetch/time, status. `Window` segmented control (5h, weekly, model-specific, extra usage). Large primary quota bar with tick and `Remaining vs ideal` legend. Right forecast card `Expected to reach 100%`, `at current pace`, confidence, reset. Main chart history solid + projection dashed. Below `Windows` compact DataTable: used%, remaining%, reset, interval semantics, last observed, data quality; source inspector Drawer listing normalized field provenance, not auth secrets. Show `No forecast for rolling window` where applicable.

### 3.4 History & Forecast — statistical workbench

Filters top: Provider, account (only verified), quota window, last `24h/7d/30d/custom`, `Observed/Projected`, `All-window/Recent active pace`, confidence toggle. Hero chart: y = quota consumed (%), x = timestamp; observed line, optional stepped points, forecast dashed, ideal time baseline dotted gray, reset line, upper/lower uncertainty ribbon when reliable, 100% threshold. Right cards: Current used, pace %/day, forecast exhaustion timestamp, vs reset (`15h early`/`safe`), sample count, observed span, quality state. Lower charts: hourly delta heatmap and daily step distribution; table allows raw snapshot download and gap warnings.

Forecast is a **scenario**, not proof. UI must show `Insufficient data`, `Stale source`, `Account changed`, `Non-monotonic rolling window`, `Large uncertainty` and `Last seen Xh ago` states instead of a deterministic date. If an operator flips to recent pace, show comparison with all-window baseline.

### 3.5 Usage & Value — separate domains

Split: provider token stats, cache hit percent, local API-equivalent estimated USD, model share. Provider subscription "quota used" must NOT be translated into tokens except as a separate **effective cap experimental research card** with strong caveats. Model table: model, input/output/cache read/cache write, total, estimated API USD, observed period and source; missing metrics show `N/A` not zero. Export CSV/JSON. If provider only yields quota percentages, render "Token telemetry not available for this adapter".

### 3.6 Projects — explicitly future

First-run consent screen explains that quota snapshots **cannot** infer actual project worked hours; requires explicit activity events from IDE, editor hooks, agent logs, KKTasks or ActivityWatch. After enable: project table, week/day heatmap, active time (detected vs inferred), tokens, estimated value, agent breakdown. User can rename/redact paths locally; no project names sent to research pool. Keep separate permission for each source; no OS-wide capture silently enabled.

### 3.7 Community Benchmarks — cohorts not people

Header `Community Benchmarks / Aggregated, voluntary data`, research policy and sample date. Filter chips provider/plan/window/region (only if cohort size safe)/model mix (if available). Charts display median, p25/p75 distribution, cohort size, observed week, coverage and methodology; card `Possible cap shift — exploratory signal`. Prohibit leaderboards/user traces. No cohort below `k=30` published; aim `k=50` for rare plan/model combos. Clear distinction of estimated _effective tokens at workload_ vs plan's true provider quota.

### 3.8 Alerts — action oriented

Rules table: Provider/window, condition (`remaining < 20%`, `forecast ETA < 12h`, `pace > 1.3x`), channel (Kunkun banner, native notification, local webhook—opt-in), cooldown, enabled. Preview alert with sampled data. Distinguish threshold observed actual vs forecast uncertain. Do not silently email/webhook credential/token contents.

### 3.9 Data & Sync / Privacy center

Cards with storage diagram: `On this device` local JSONL/SQLite; `Private cloud history` optional account sync; `Community research` independently optional; `Export/Delete`. Explicit four-choice consent: `Local only` default; `Cloud sync, not research`; `Research aggregate contribution`; `Project activity upload` off and independently granted. `See exact payload` drawer renders redacted sample. Retention controls local 30/90/forever, cloud 14d hot and archives; request deletion and confirmation. Banner: `Pseudonymized telemetry can carry reidentification risk; no project paths or prompt contents in research dataset`. Disable telemetry without losing access to baseline free quota.

### 3.10 Settings & Connections

Categories: Providers & diagnostics; Scheduler & sampling (`Adaptive`, 15m active-short-window, 60m default, off); Network & rate-limit cooldown; Appearance (dark/system/light, reduced motion, units); Data location & export; Account & cloud; Permissions. Show actual impact of tighter cadence on CPU/network/account and cloud volume. `Never run login automatically` default and immutable product safety requirement.

### 3.11 Kunkun panel / menu bar / island

Kunkun compact 420–520px: one-line status, independently labeled provider mini rows with `45% left`, white ideal marker, next reset, tiny trend arrow. On click expands right-side preview pane (as in Kunkun's third palette concept) or opens full dashboard. User can pin 2 favorite windows; no endless scroll inside small island. Dynamic Island shows 1–2 windows + a warning only; context action expands to menu/panel. Colors and data contract exactly match main Dashboard.

## 4. Design system and shadcn component implementation map

| UI area                      | Recommended component(s)                                                   | Functional notes                                                                 | Evidence                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Navigation                   | shadcn `Sidebar`, `Breadcrumb`, `Command`                                  | `Cmd+K` provider/page search; keyboard first                                     | [shadcn Sidebar](https://ui.shadcn.com/docs/components/sidebar)                                                           |
| Provider quota card          | shadcn `Card`, `Badge`, `Tabs`, `Tooltip` + custom `PacedProgress`         | Overlay white tick at precise X; use CSS custom prop, aria value                 | [shadcn Progress](https://ui.shadcn.com/docs/components/progress)                                                         |
| Forecast history             | shadcn `ChartContainer`, `ChartTooltip`, `ChartLegend` (Recharts)          | SVG `ReferenceLine` at 100/reset, `Area` CI and dashed projection; zero guessing | [shadcn Charts](https://ui.shadcn.com/charts)                                                                             |
| Model, window, snapshot grid | TanStack Table + shadcn `Table`, `DataTable`                               | Virtualize if long; stable sorting/date; row expansion                           | [Shadcn Studio DataTable Grouping](https://shadcnstudio.com/blocks/datatable/datatable-grouping) (license tier to verify) |
| Filters and time controls    | shadcn `Select`, `Popover`, `Calendar`, `ToggleGroup`, `DatePicker` recipe | Faceted per-window filters; URL backed                                           | [shadcn components](https://ui.shadcn.com/docs/components)                                                                |
| Privacy / permissions        | `Switch`, `RadioGroup`, `AlertDialog`, `Accordion`, `Drawer`               | Explicit opt-in + redacted payload preview; focus return                         | [shadcn Drawer](https://ui.shadcn.com/docs/components/drawer)                                                             |
| Toast and status             | `Sonner`, `Alert`, `Skeleton`, `Empty`                                     | Cache/stale/error consistent across pages                                        | [shadcn Sonner](https://ui.shadcn.com/docs/components/sonner)                                                             |
| Fine interactions            | optional Animate UI `Combobox` / `Dropdown`                                | Animate open/close only, no table-row animations                                 | [Animate UI](https://animate-ui.com/docs/primitives/base-ui/combobox)                                                     |

**License boundary:** shadcn studio components vary Free/Pro; verify the individual block license before copying. This document identifies patterns; no third-party paid component source is included. Browser demo keyboard/dark-mode interaction not re-tested in this turn; items are architecture recommendations.

### Visual tokens

- Background: `#09090b`; panels: `#111113`; border: `#27272a`; foreground: `#fafafa`; secondary: `#a1a1aa`; high-density typography with 14px body, 12px captions and tabular numerals.
- Accent: chart observed `#22c55e` (mint/green); forecast `#eab308` (amber); Codex `#818cf8` (indigo); Claude `#da7756` (terracotta); agy `#38bdf8` (cyan). Account/source colors are brand references only; semantic risk states have text/icons as well.
- 8px spacing base; 12px panel radius; 1px border; chart stroke 2px; white tick 2px, minimum ~12px high. On bright background, tick uses contrast stroke/shadow.
- At viewport <1024px sidebar collapses; at <700px charts become single column with accessible summary/table; mobile read-only dashboard does not try to render menu-bar UI.
- Focus ring always visible; `aria-valuenow` for actual quota only. Add `aria-description` for ideal pace and a visible legend; `prefers-reduced-motion` honored, chart updates only on actual data changes.

## 5. Screen flow + microcopy

1. First launch → `Providers` detects codex/agy/claude independent states → show Overview with available data, prompt _only_ to enable local history. No cloud account gate.
2. User turns on local history → prompt sampling interval + path + retention, save a first observed snapshot → Overview mini chart becomes available after second distinct sample.
3. Once sufficient data → Forecast card transitions from `Collecting data` to `Early estimate` to `Trend established`; hover explains evidence span and confidence, never a purely color-only signal.
4. Optional cloud signup → `Data & Sync` explains private history vs community research separately → user sees sample payload and consent → remote sync. Uncheck research → stop future contribution immediately and offer delete-request path for retained raw research contributions.
5. Provider 429/401 → leave last valid reading visibly `STALE` with age, disable manual refresh in cooldown, show non-invasive next-step guidance.

UI wording examples: `45% left · resets in 3d 12h`; `Ideal remaining now: 50%`; `Usage pace: +10% faster than even distribution`; `Estimated exhausted: Nov 11, 08:00 (low confidence, only 2h sampled)`; `No estimate: rolling window refill is not modeled`; `Private history is OFF · Data remains on this Mac`.

## 6. UX visual QA checklist (concept renders and later code)

- [ ] Each page uses identical nav, typography, icon sizes, spacing and provider color mapping.
- [ ] Time-window, used/remaining orientation, observed/projection legends are consistent; every chart's 100% line is quota **used**.
- [ ] There is no combined quota percent and no sum of percentages across providers or windows.
- [ ] Missing auth, sparse history, sleeping client, offline cloud, rate limit and reset are shown as states.
- [ ] Provider Detail and History share the same selected window; filters URL/deeplink-safe.
- [ ] Community data contains only aggregated cohorts with sample counts and explicit opt-in; no sample user rows.
- [ ] Project activity is labeled opt-in beta, never inferred directly from percentage deltas.
- [ ] 1440px, 1024px, 768px, 420px layouts; keyboard, focus, screen reader, reduced motion, print/export.
- [ ] Concept images use **fictional illustrated figures**, not claims about HK's current subscription state; source screenshots are only visual reference.

## 7. Page mockup generation brief

Generate 10 shadcn-style desktop and compact compositions in the exact same visual system. Deliver individual page visuals or legible two-screen boards:

1. Overview (provider cards + white pace ticks + warning card).
2. Provider detail (Claude all windows + chart, inspector drawer).
3. History & forecast (observed + dashed forecast + confidence/sampling).
4. Usage & Value (model table, cached token ratio, estimated API value).
5. Projects & Activity (clearly opt-in beta, heatmap and activity table).
6. Community Benchmarks (cohort distribution with suppression notice).
7. Data & Sync / Privacy (side-by-side private cloud and anonymous research toggles, payload preview).
8. Settings & Connections (provider adapters, local scheduler, refresh policy).
9. Alerts & Automations (rule configuration, preview notification).
10. Kunkun launcher compact panel, macOS menu bar/island overlay (small surface, same white tick).

**Do not embed unrelated "all providers combined utilization" charts.** Any generated metric is demonstrative, fictional and provider-window-specific.  
Next documents: `docs/specs/2026-11-06-kuota-history-cloud-spec.md`, `docs/research/2026-11-06-kuota-telemetry-cost-research.md`, `docs/superpowers/plans/2026-11-06-kuota-history-forecast.md`.
