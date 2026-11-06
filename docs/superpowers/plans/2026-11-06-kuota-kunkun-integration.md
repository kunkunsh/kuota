# Kuota Kunkun Integration and History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eventually embed Kuota's existing reusable TypeScript quota library into Kunkun v2.1 through explicit host-side permissions and a React UI, while preserving the standalone CLI/TUI and leaving cloud history opt-in.

**Architecture:** A thin Kunkun adapter executes Kuota provider probes in the trusted plugin host via its actual permission broker; only validated, redacted snapshots cross the IPC/RPC boundary into React/WebView. Future local/history/cloud pipeline is separate from quota fetching and gated on Kunkun sync/storage design.

**Tech Stack:** Kuota TS/Effect + Vite Plus; Kunkun user-described native shell, React 19, Tailwind, shadcn, Deno runtime and dynamic permission broker. **Kunkun v2.1 SDK is not verified from an actual local checkout yet.**

**Spec:** [`docs/superpowers/specs/2026-11-06-kuota-phase2-design.md`](../specs/2026-11-06-kuota-phase2-design.md).

## Global Constraints

- This plan is **conditional**. Never code against a hypothetical Kunkun SDK. First identify actual v2.1 revision and permission API, collect a minimal plugin example, and present discoveries to HK.
- `@kuota/core` and `@kuota/providers` must continue building and running independently of Kunkun.
- Browser/WebView code gets only sanitized provider results, **no filesystem, process spawn, env token, raw OAuth or HTTP response access**.
- Provider-by-provider permission requests; no blanket Deno `--allow-all`, unmanaged shell escape, or silent npm installation on end-user machines.
- User's desired cloud quota report is a distinct privacy and storage project. No cloud writes until explicit opt-in, schema, retention and cost approved.
- Follow TDD and commit in small slices, updating `HANDOFF.md` after each implementation milestone.

## Review Focus

SDK drift, provider-scoped grants, Deno Node compatibility, package artifact resolution, path discovery, zero prompt by default, bundled size, Windows/Linux/macOS differences, account switching, metrics semantics, cloud privacy, schedule overlap and duplicates.

---

## Task K0 — Mandatory Kunkun v2.1 discovery gate **[BLOCKING]**

**Do not start K1 until this is complete.**

- [ ] Ask HK for actual Kunkun v2.1 checkout URL/branch/commit if not already available. Public `https://github.com/kunkunsh/kunkun` appears to include legacy Tauri/Svelte files alongside newer Deno API material; it cannot be assumed to reflect the current React version.
- [ ] Inspect real plugin manifests, installed extension sample, RPC/UDS bridge, Deno permission broker, path/executable allowlists, WebView content security policy, preferences storage, and UI extension lifecycle.
- [ ] Record exact source permalinks + commit in `docs/research/kunkun-integration-discovery.md`; document whether plugins can run Node-only libraries or subprocesses, whether there is a host executor API, and how permissions are surfaced to users.
- [ ] Test a **minimal harmless** plugin that sends static `providers.list` metadata to a WebView, without quota probes or credentials.
- [ ] Pick runtime path based on evidence: (A) existing Deno runner with explicit `node:child_process` compatibility, (B) Kunkun-provided host broker, (C) a packaged Kuota Node/Bun executable behind an allowlisted subprocess bridge. Record cold start, memory, bundle size and OS feasibility before choosing.
- [ ] Obtain HK review/acceptance of permissions and package model. Do not silently proceed if SDK or permission API is missing.

## Task K1 — Define portable backend RPC schema

**Files:** Create `packages/kunkun-adapter/` **only after K0**. Proposed files `src/protocol.ts`, `src/protocol.test.ts`, `src/index.ts`; existing `@kuota/core` unchanged. Alternatively put adapter in Kunkun repo when its SDK packaging requires that; keep schema transport-neutral.

```ts
type KuotaHostRequest =
  | { kind: "providers.list" }
  | { kind: "snapshots.read"; ids?: ProviderId[]; force?: boolean };

type KuotaHostReply =
  | { kind: "providers.list"; providers: readonly ProviderMetadata[] }
  | { kind: "snapshots.read"; observations: readonly QuotaObservation[] };
```

- [ ] RED: schema rejects arbitrary provider IDs, proto pollution keys, unexpected operation names, oversized array, non-boolean `force`, invalid percentages and bad timestamps. Use Effect Schema decode at boundaries.
- [ ] RED: serializer never exposes credential fields, raw stderr or upstream raw payload even if provider fixture contains extra properties.
- [ ] GREEN: minimal serializable request/reply types with monotonically versioned protocol e.g. `protocolVersion:1`; model permission-denied errors as sanitized per-provider results.
- [ ] Commit `feat(kunkun): add typed transport-neutral quota RPC`.

## Task K2 — Host permission broker and provider reader

**Files:** adapter `src/host.ts`, `host.test.ts`, permission manifest under actual SDK-defined location (decide after K0).

Provider capabilities to map to actual Kunkun SDK:

| ID            | Read capability          | Additional trusted-host need                                                 | Denied behavior                        |
| ------------- | ------------------------ | ---------------------------------------------------------------------------- | -------------------------------------- |
| `codex`       | `kuota.codex.read`       | Spawn pre-existing `codex app-server` and bounded JSONL pipes                | `PERMISSION_DENIED`                    |
| `claude`      | `kuota.claude.read`      | Read approved existing OAuth credential source, HTTPS to `api.anthropic.com` | `PERMISSION_DENIED` or `AUTH_REQUIRED` |
| `antigravity` | `kuota.antigravity.read` | Spawn pre-existing `agy`, create temp private dir, bounded print             | `PERMISSION_DENIED`                    |

- [ ] RED: all grants denied → no process spawn/no filesystem read/no HTTPS call, three sanitized permission-denied snapshots.
- [ ] RED: grant Codex only → Codex fake provider called once, Claude/agy never invoked. Revocation invalidates any cached result for revoked provider.
- [ ] RED: concurrent host RPC calls share service instance and singleflight; a `force:true` does not bypass cooldown.
- [ ] RED: UI does not receive tokens, process args containing tokens, emails, account IDs or raw vendor data.
- [ ] GREEN: host adapter wires a singleton `createQuotaService`, matches actual runtime/permission interfaces, returns decoded/sanitized observations.
- [ ] Commit `feat(kunkun): permission-scoped Kuota host adapter`.

## Task K3 — Kunkun React panel / command palette integration

**Files:** Actual Kunkun plugin workspace decided in K0, not Kuota core. Reuse installed React 19 + Tailwind/shadcn components, do not introduce a second styling system.

**Suggested UX:** Compact command palette card shows provider, percentage remaining per 5h and weekly window, reset countdown, freshness and auth status. Expanded dashboard shows separate quota bars by model, data source, last-success time, retry countdown, error tips, provider enable toggles, and a clickable `doctor` guide. Never combine monthly billing dollars with quota percentages in one ambiguous progress bar. Keyboard-first, dark theme, screen-reader text labels.

- [ ] RED UI: healthy, stale, no-measurement, missing CLI, login required, permission denied, cooldown; empty state explains next action.
- [ ] RED UI: permission prompt is only triggered by deliberate user action, not automatic pane mount. Denied state remains usable.
- [ ] RED UI: refresh is disabled/countdown during hard 429 cooldown; focus order and keyboard accessibility work; no secret in inspector or devtools state.
- [ ] GREEN: React component pulls typed host RPC and renders sanitized read-only observations. Component can be embedded as command palette preview or dashboard widget.
- [ ] Screenshot/manual QA for macOS; verify no renderer network direct to private provider API.
- [ ] Commit `feat(kunkun): add quota dashboard plugin UI` in the repo that owns the plugin.

## Task K4 — Packaging / installation / cross-platform smoke

- [ ] Evaluate Deno-compatible compiled artifact: no npm install required for user; run against actual bundled plugin runtime. If existing Node adapters cannot run due to Deno permissions or `node:*` support, package self-contained helper with explicit hash/size and approved subprocess grant.
- [ ] Test macOS arm64 as primary. Record Windows path/Named Pipe and Linux assumptions; leave unsupported combination gracefully unavailable. Do not promise cross-platform parity without smoke.
- [ ] `kuota doctor` or plugin diagnostics explain missing Codex/agy CLI, no silent external installation.
- [ ] Validate no net access needed for Codex local JSON-RPC, only permitted network access for Claude, and any agy upstream behavior is broker-controlled.
- [ ] Verify standalone `bun run test`, `build`, Node CLI remain functioning after packaging changes.

## Task H0 — Future quota-history product decision **[DEFERRED]**

This is the idea HK mentioned in the adjacent session: after Kuota is a Kunkun plugin, periodically report quota/usage to Kunkun cloud so a dashboard can show daily trends. Record now; do not implement until Kunkun synchronization and flexible per-plugin DB decisions are made.

- [ ] Product choices: local-only default vs opt-in cloud; data ownership; provider/account scope; retention (e.g. 30/90 days), data export and delete; collection cadence; UI visibility.
- [ ] Distinguish **quota** (window remaining/reset) from **usage** (tokens/time/cost), **activity** (session lifecycle), and **billing** (invoiced cost); not all providers expose each. Missing data is null/not supported.
- [ ] Security: do not upload credentials, CLI transcripts, project names, command history, account emails, device secrets, or raw provider responses. Prefer anonymized user+device+provider keys allocated by Kunkun, not guessed identity.
- [ ] Flexible DB: design an append-only, tenant-scoped event schema rather than arbitrary shared SQL tables exposed to every plugin. Each plugin gets namespace/capability guard even when storage is JSON/document-backed.
- [ ] Sample future envelope (draft only):

```ts
interface QuotaHistoryEventV1 {
  schemaVersion: 1;
  eventId: string; // client-created UUID for idempotent retry
  deviceId: string; // Kunkun opaque device ID, not hostname
  provider: ProviderId;
  observedAt: string;
  windows: Array<{ windowId: string; remainingPercent: number | null; resetAt: string | null }>;
  source: string; // allowlisted source ID
  freshness: "live"; // do not upload stale as a new reading
}
```

- [ ] Cloud scheduler must not bypass provider local cooldown; repeated hourly events dedup by eventId/provider/time window and handle offline queueing. No scheduled task is created until opt-in.
- [ ] Estimate D1/Turso/R2/Workers storage, query and request costs based on expected cadence and 100/1k/10k users after deciding on Kunkun data sync architecture.
- [ ] User approval gate before any upload, auth, job schedule, retention/deletion policy, or multi-tenant access implementation.

## Completion criteria

- [ ] Actual v2.1 SDK commit and API references captured before code.
- [ ] Each provider needs an explicit permission; denial is observable and harmless.
- [ ] No OAuth tokens, CLI stdout, raw server bodies or private metadata enter WebView or cloud.
- [ ] Standalone library, CLI and TUI remain decoupled and independently testable.
- [ ] Kunkun host probes are cached/coalesced and respect per-provider rate limit.
- [ ] React panel passes typed payload/security tests and keyboard QA.
- [ ] Packaging requires no npm install on user's device and supports at least verified macOS arm64 configuration.
- [ ] Cloud history remains a documented future idea until the separate decision gate.

**Sources:** [Kunkun public repository](https://github.com/kunkunsh/kunkun), [Kuota own design](../specs/2026-11-06-kuota-phase2-design.md), [UniView](https://github.com/HuakunShen/uniview), [Effect CLI](https://github.com/Effect-TS/effect/tree/main/packages/cli), [Vite Plus monorepo](https://viteplus.dev/guide/monorepo).
