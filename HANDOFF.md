# Kuota — AI Implementation Handoff

> **READ THIS FIRST before changing code.** This file is the authoritative work-in-progress handoff for a future AI agent. It describes the **existing implemented baseline**, the **not-yet-implemented proposals**, exact steps to continue, safe boundaries and verification. Read source/tests rather than treating plans as implemented code.

- **Last handoff update:** 2026-11-06 (Toronto timezone)
- **Owner:** HK
- **Local repo:** `/Users/hk/Dev/kuota` on `HKs-Mac-mini.local`
- **Branch at planning start:** `main`
- **Baseline implementation commit:** `41a13e9 feat: bootstrap Kuota Effect CLI and UniView TUI with quota adapters`
- **Git remote:** None configured at planning start; **do not publish/push** without HK's explicit instruction.
- **Drive master folder:** [Google Drive / projects / kuota](https://drive.google.com/drive/folders/10RVDLtwfJGPQnI9sX5LKpkqGVqLdXdU5)
- **Earlier design/research folder:** [Google Drive / projects / Kunkun V2.1 / Research / Kuota](https://drive.google.com/drive/folders/1tbFYypqi8QTF7TCX4TMKdUB96Dt_uxvi)

> **2026-11-06 LATER UPDATE — coding resumed & Snapshot / Concept UI fully integrated.**
>
> - **CLI:** Complete suite including `status`, `providers`, `doctor`, `collect --once`, `history`, `forecast`, `pace`, `snapshot [--inspect] [--json]` (live vendor read with full field inspection), and `snapshots [--limit n] [--json]` (journal query).
> - **TUI:** UniView interactive terminal dashboard (`p` provider cycle, `w` window cycle, `r` refresh, `s` snapshot inspector toggle, `q` quit).
> - **Web UI / Kunkun v2.1:** Full React 19 + shadcn dashboard implementing all 11 concept screens from Google Drive and HK's reference screenshots. Added runnable Vite dev server (`bun run dev` or `bun run dev:web` on `http://localhost:5173`) with live/mock fixtures and interactive snapshot inspector drawers.
> - **Verification:** 133 tests across 18 test files pass; `bun run typecheck` has 0 errors; all 6 monorepo packages build cleanly (`vp run -r build`). Zero cloud deployment or credential reading without user consent.

> **2026-11-06 UPDATE — HK asked us to STOP further programming and hand all files to another AI.** The original 32-test baseline remains, plus one small already-written pure pacing slice (13 tests). At last Mac mini verification **45 tests across 8 suites and `bun run typecheck` passed**. No journal/forecast/CLI integration/Kunkun cloud UI is implemented. Current changes are not committed. For the exact status, known image QA problems and full implementation prompt, read:
>
> - [`docs/implementation-status-2026-11-06.md`](docs/implementation-status-2026-11-06.md)
> - [`docs/design/2026-11-06-kuota-concept-gallery.md`](docs/design/2026-11-06-kuota-concept-gallery.md) — 11 numbered shadcn page images
> - [`docs/handoff/2026-11-06-kuota-ai-implementation-prompt.md`](docs/handoff/2026-11-06-kuota-ai-implementation-prompt.md) — comprehensive ready-to-paste agent prompt
> - [Notion design/user stories gallery](https://app.notion.com/p/410cefcfcbfd814fb4b9eff12b982b15?pvs=204) and [Drive image gallery](https://drive.google.com/drive/folders/1LndhYb13cKjFijWzclnRwiZ1whEpt4n-)

## 0. User's nonnegotiable product intent

- **Name:** Kuota (quota pun and Kunkun-adjacent branding), repo `kuota`, binary `kuota`.
- **Language:** TypeScript. **Monorepo:** Bun workspaces with **Vite Plus 1.5** project-local tooling. **Effects:** Effect TS 3, Effect CLI. **TUI:** HK's [`kunkunsh/uniview`](https://github.com/HuakunShen/uniview), React renderer, do not reinvent it.
- Produce **both** useful headless CLI / reusable TypeScript library / UniView TUI; **future Kunkun plugin** through a permissioned adapter, not hardwired into core.
- Test on HK's existing macOS **Mac mini** where `codex`, `agy`, `claude` CLIs are installed. Use existing authenticated sessions only. Do not auto-login or prompt the user.
- Source inspiration: [CodexBar](https://github.com/steipete/CodexBar); providers use _different acquisition methods_. Do not assume a universal command.
- Separate quota windows, honest missing-status reporting, privacy, minimal external dependencies, no end-user npm installation when eventually packaged into Kunkun.
- **One exception:** pure fixed-window pacing (`packages/core/src/metrics/pace.ts`) and 13 tests were implemented and verified before HK asked to stop coding. **Everything else in the new history/forecast/cloud proposals remains unimplemented.**

## 1. What already works (baseline, not a promise of future functionality)

| Capability                           | Code                                                         | State                                                                                  |
| ------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Typed quota windows and status       | `packages/core/src/{types,normalize}.ts`                     | Implemented, unit tested                                                               |
| Provider registry, failure isolation | `packages/providers/src/registry.ts`                         | Implemented, unit tested                                                               |
| Codex rate limits                    | `packages/providers/src/codex/{protocol,transport,index}.ts` | Implemented, **live tested** via `codex app-server`                                    |
| Antigravity quota                    | `packages/providers/src/antigravity/index.ts`                | Implemented, **live tested** via `agy -p /usage`                                       |
| Claude subscription quota            | `packages/providers/src/claude/index.ts`                     | Implemented, fixture-tested; **not live tested** on Mac mini because Claude logged out |
| CLI                                  | `packages/cli/src/{main,commands}.ts`                        | `status`, `providers`, `doctor`, `tui`; `--json` schema 1                              |
| UniView TUI                          | `packages/tui/src/{main,app}.tsx`                            | Rendered in automated tests; **manual interactive TTY smoke pending**                  |
| Build/test toolchain                 | root `package.json`, `vite.config.ts`                        | Four packages; Vite Plus `vp` commands                                                 |

**Verification:** 2026-11-06: **8 suites / 45 tests passing**, including 13 new pace tests; `bun run typecheck` passed. `bun run build` / `bun run check` have **not** been repeated after pace addition; do not claim they are green. Earlier 2026-11-05: 7 suites / 32 tests, build 4/4, typecheck/check passed. Mac mini versions then: Bun 1.4.4, Node 24.13.0, Vite Plus 1.5.0, Claude Code 2.1.63, Codex 0.147.0, agy 1.5.1. `claude auth status --json` reported `loggedIn:false`; `~/.claude/.credentials.json` unavailable. All these source states can change; verify anew. Detailed logs: `docs/implementation-status-2026-11-06.md` and prior `2026-11-05.md`.

### Commands to run now

```bash
cd /Users/hk/Dev/kuota
git status --short --branch
git log -3 --oneline

bun install                   # only if deps unavailable; should already exist
bun run test
bun run typecheck
bun run check
bun run build

bun run cli -- providers --json
bun run cli -- doctor --json
bun run cli -- status --json
bun run cli -- status --provider codex --json
bun run cli -- status --provider antigravity --json

# Built Node executable after build
node packages/cli/dist/main.mjs providers --json

# Interactive terminal ONLY, requires genuine TTY
bun run tui
```

**Do not run in a loop.** The current one-shot CLI has no shared persistent cooldown. Real providers may rate-limit. Avoid querying Claude repeatedly on 429. Do not paste complete JSON if it contains any unexpected account info. `doctor` only asserts executable presence, not authentication. In remote Desktop Commander pseudo-terminal, the UniView real TTY cannot be verified; use Mac Terminal.app for `bun run tui`.

## 2. Current package architecture and hard boundaries

```text
kuota/
├── HANDOFF.md                            <- this file; update after work
├── README.md                             <- usage, semantics and references
├── package.json                          <- Bun workspaces, Vite Plus scripts
├── packages/
│   ├── core/src/                         <- platform-neutral Effect schemas + normalize
│   ├── providers/src/
│   │   ├── registry.ts                   <- QuotaProvider, builtInProviders, readAll
│   │   ├── codex/                        <- app-server JSON-RPC probe
│   │   ├── claude/                       <- OAuth private usage HTTP probe
│   │   └── antigravity/                  <- agy structured print probe
│   ├── cli/src/                          <- @effect/cli + JSON/plain output
│   └── tui/src/                          <- UniView React render + keyboard
└── docs/
    ├── implementation-status-2026-11-05.md
    ├── specs/2026-11-05-kuota-design.md  <- original v0.1 vision; aspirational
    ├── research/2026-11-06-kuota-provider-research.md
    └── superpowers/
        ├── specs/2026-11-06-kuota-phase2-design.md
        └── plans/
            ├── 2026-11-05-kuota-mvp.md  <- original implemented MVP plan
            ├── 2026-11-06-kuota-refresh-service.md
            ├── 2026-11-06-kuota-provider-hardening.md
            └── 2026-11-06-kuota-kunkun-integration.md
```

**Read `packages/core/src/types.ts` before changing shapes.** Actual `QuotaSnapshot` only has `provider`, `status`, `fetchedAt`, `source`, `windows`, `errorCode`; no account ID, billing, or cache metadata. The old `docs/specs/2026-11-05-kuota-design.md` sketches aspirational properties beyond the MVP. The **2026-11-06 spec** describes forward-compatible handling while preserving JSON v1. An implementation agent should prioritize **actual code and tests over old spec wording** and update docs when changing it.

## 3. Prioritized instructions for next implementation agent

| Order | Plan                                                                                             | Why                                                                  | Requires approval?                                             |
| ----- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1     | [`refresh-service.md`](docs/superpowers/plans/2026-11-06-kuota-refresh-service.md)               | Rate-limit hygiene, singleflight, TUI freshness; clear isolation     | No, local code and fixtures only                               |
| 2     | [`provider-hardening.md`](docs/superpowers/plans/2026-11-06-kuota-provider-hardening.md)         | Claude credential precedence, robust HTTP, Codex/agy transports      | No, except **Keychain optional task K**                        |
| 3     | Manual TUI/CLI smoke                                                                             | Ensure actual macOS UX and child cleanup                             | HK may need to operate Terminal.app; do not obtain credentials |
| 4     | [`kunkun-integration.md`](docs/superpowers/plans/2026-11-06-kuota-kunkun-integration.md) Task K0 | Need **actual Kunkun v2.1 SDK** / Deno permission broker before code | **Review/discovery gate**                                      |
| 5     | Kunkun host/React bridge (K1–K4)                                                                 | Only after verified K0 and permission UX                             | Confirm architecture with HK                                   |
| 6     | Cloud quota history/report H0                                                                    | Product idea, depends on Kunkun sync/privacy/cost                    | **Separate opt-in approval**                                   |

### Immediate task slice: what I would give a non-frontier model

1. Read `HANDOFF.md`, current test files and the Phase 2 spec. Report `git status` and baseline.
2. Implement **only Task 1** from refresh-service plan: pure `QuotaObservation` wrapper and tests. Do not touch auth or Kunkun.
3. Run targeted red test, code minimal green, full tests/typecheck/check/build. Commit only that change.
4. Proceed to Task 2 TTL service; fake providers/fake clock, no live endpoint in unit tests.
5. Continue through Tasks 3–6 in order. Do not simultaneously refactor every adapter or change CLI schema; small reviewable commits.

### Progress tracker (set checkboxes only after evidence)

- [ ] Phase 2 Task 1: observation wrapper + pure tests
- [ ] Phase 2 Task 2: TTL service and per-provider isolation
- [ ] Phase 2 Task 3: singleflight + cooldown + invalidation
- [ ] Phase 2 Task 4: retry-after policy decision and tests
- [ ] Phase 2 Task 5: singleton service in UniView, stale display
- [ ] Phase 2 Task 6: CLI v1 compatibility + docs
- [ ] Phase 2 Task 7: real Terminal.app TUI smoke
- [ ] Provider hardening Task 1: deterministic Claude credential precedence
- [ ] Provider hardening Tasks 2–5: HTTP/Codex/agy/doctor behavior
- [ ] Kunkun K0: actual SDK discovery, commit SHA, permission API, approved plan
- [ ] Kunkun K1–K4: typed host bridge/React/packaging
- [ ] H0: consent, storage/sync and privacy decision for cloud history

### New local-history milestone (planned; do not mistake pure math for live monitoring)

- [x] **H1 pure pace function only:** `packages/core/src/metrics/pace.ts` with 13 unit tests, no provider startAt wiring / CLI/TUI display; uncommitted
- [ ] H2: Effect Schema events, account/session scoping, durable/deduplicated JSONL history, `kuota collect --once` and `kuota history --json`
- [ ] H3: robust fixed-epoch forecast + confidence with CLI `kuota forecast --json`; rolling unsupported until modeled
- [ ] H4: UniView white mark + mini trend + real TTY smoke
- [ ] H5: Kunkun React 11-screen UI/permission bridge, pending SDK review
- [ ] H6: optional private cloud D1/R2 ingestion/archive/restore, **requires HK's explicit approval**
- [ ] H7/H8: opt-in community benchmarks and project analytics, separate privacy review and authorization

## 4. Provider-specific baseline, testing and pitfalls

### Codex

- **Implementation:** `codex app-server` JSONL RPC. After `initialize` and `initialized`, call `account/rateLimits/read`, parse official rate limit response.
- **Never do:** `codex -p` model prompt to obtain quota, dump `~/.codex/auth.json`, bill against general API account instead.
- **Test:** fake app-server JSONL fixture with notifications, half-lines, oversized response, timeout, exit, missing binary. Live smoke once; no frequent polling.
- **Source:** https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/GetAccountRateLimitsResponse.ts

### Claude

- **Implementation:** existing **subscription** OAuth token and private GET `https://api.anthropic.com/api/oauth/usage?cedar_ember=1` (fallback to no query on 400/403), with `anthropic-beta: oauth-2025-04-20`.
- **Status:** parser and fetch mock tests pass. Local Claude **logged out at baseline**; no live quota proof. Existing token source precedence has an issue: explicit `credentialsFile` should override environment by design, but currently does not.
- **Never do:** read Keychain or force sign-in automatically; print `CLAUDE_CODE_OAUTH_TOKEN`; convert HTTP 429 into proxy rotation; claim API key gives subscription rate limits.
- **Test:** fake fetch, temp fake credential file; 200/401/429/400 retry/timeout/invalid percent/body cap. If user signs in later, live test only once.
- **Source:** https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Claude/ClaudeOAuth/ClaudeOAuthUsageFetcher.swift

### Google Antigravity / agy

- **Implementation:** `agy --version`, then `agy -p /usage --output-format json --print-timeout 90s`, parse structured grouped buckets. `AGY_CLI_DISABLE_AUTO_UPDATE=true`, browser-launch suppression, external timeout and output limit.
- **Status:** live on Mac mini 1.5.1; print mode doesn't provide trustworthy account ID.
- **Never do:** assume `agy` browser signin is safe, parse ad hoc screenshot, mix model families or weekly with five-hour limits, cache across accounts without identity.
- **Test:** fake executable and structured fixtures, blocked browser execution, process group timeout and signal escalation, 0/1 fractions and malformed group.
- **Sources:** https://github.com/steipete/CodexBar/blob/main/docs/antigravity.md and parser linked in research doc.

## 5. Security stop conditions and approval boundaries

**Stop and ask HK** before any of:

1. macOS Keychain, security prompts, requesting/inserting OAuth tokens or credential extraction outside routine configured runtime behavior.
2. Launching login browser, refreshing or rotating vendor OAuth credentials, adding a new OAuth callback/proxy.
3. Kunkun v2.1 SDK unknown and requiring a guessed permission bypass; requesting blanket Deno/host filesystem or shell capabilities.
4. Creating/pushing a GitHub repo, publishing npm packages, changing versioned public JSON schema, changing license, installing system-wide tooling.
5. Turning on cloud upload, background jobs/cron, storage of usage history, sending vendor/account identifiers off device.
6. Destructive cleanup of user processes, worktrees, cloud files or repo history. Kill only child PIDs **created by the test** and actually verified to be yours.

Safety rules for allowed local development: sanitized `errorCode` only; no raw stderr, stdout, HTTP response body or tokens; no fake 0%; bounded spawn and fetch; preserve all unrelated files; always inspect `git status` before edit/commit; avoid empty broad filesystem globs; don't commit `node_modules`/`.env`/credentials/temp reports.

## 6. Definition of Done per small task

- [ ] One failing test proved desired behavior beforehand, then passes with minimal implementation.
- [ ] Public TypeScript exports and JSON compatibility reviewed.
- [ ] `bun run test`, `bun run typecheck`, `bun run check`, `bun run build` pass. If any command fails, report cause honestly and do not claim finished.
- [ ] Provider failure fixture does not leak tokens and other providers still return.
- [ ] Update relevant docs/test matrix; mark actual implementation status vs proposal.
- [ ] `git diff --check`, `git status --short` verified; commit **only intended task files** with descriptive message; no push.
- [ ] Report commit short SHA, exact tests run/results, limitations and next uncompleted task.

## 7. Google Drive and source map

`projects/kuota` is the **target master folder** for research/design/implementation/handoff Markdown copies. Repo docs are the source of truth for code-facing plan; Drive copies are handoff/reference. If updating content, sync both, explicitly label revision/version to avoid divergent copies.

**Direct links to this handoff release (2026-11-06):**

- [Technical research: provider methods, pitfalls and source references](https://drive.google.com/file/d/1XgJU_cQ8N0u4TgxEQdZGfdFPuogFe-mf/view)
- [Phase 2 architecture/specification](https://drive.google.com/file/d/1mup2Ex_Kgh25sHnJaOjHzbaE4o5Kzap1/view)
- [Implementation plan: TTL, singleflight, cooldown and TUI](https://drive.google.com/file/d/1qbM9iD4VFGPJnrooObBaj4VgVaj46t6Z/view)
- [Implementation plan: Claude/Codex/agy provider hardening](https://drive.google.com/file/d/1Ej8PrnlD8zYyCassUMPqZVc6Ddqkvo9K/view)
- [Implementation plan: Kunkun permission broker and future cloud history](https://drive.google.com/file/d/1VzwvAEWVaof2YRg006OnD66t7T_2VOee/view)
- [Drive copy of this `HANDOFF.md`](https://drive.google.com/file/d/1Do7NAYW1yu-bhiAmvpkMm7HLSaFAF3N8/view)

Previous material from Kunkun's nested research folder (may be mirrored into the direct project folder):

- [CodexBar deep research](https://drive.google.com/file/d/1WMTUBhUCU5krn5UYSTBxB0AWA24x4XKA/view)
- [CodexBar provider-method inventory](https://drive.google.com/file/d/1d7rYqTB0SdFUZkO-N2PFN9sVoIgBHheV/view)
- [Original Kuota architecture spec](https://drive.google.com/file/d/1a8RJKDReoHwABjkaGTwxrBfk7yAjVPoY/view)
- [Original Kuota MVP plan](https://drive.google.com/file/d/1PT7xJTlTa3RUtf0vxQfa_-K3UehC5uom/view)
- [Initial implementation verification](https://drive.google.com/file/d/1hOoPPUE0a7MO8g1PlbNe203iBgLVppo6/view)

### New 2026-11-06 design + history/forecast references

- [UX/IA design and 14 user stories](https://drive.google.com/file/d/16pDKg1doGfwdghALxjw_gm0aJxCTFfc7/view)
- [History, pacing, forecast, sync, R2/D1 and privacy technical spec](https://drive.google.com/file/d/1pRMXltsLe2WGeS7LQ5azmPAXFIO0oD9t/view)
- [Cloudflare costs, DuckDB/Parquet and crowdsourcing research](https://drive.google.com/file/d/1UNiWoditK8E9a9VtrWuftUhieQKJtxRO/view)
- [History/forecast TDD implementation plan](https://drive.google.com/file/d/1zONVPtLPS59C_D2tyMxlLzMPBgSiVV8C/view)
- [11 screen shadcn concept image gallery](https://drive.google.com/drive/folders/1LndhYb13cKjFijWzclnRwiZ1whEpt4n-)
- [Notion product specification and link index](https://app.notion.com/p/410cefcfcbfd814fb4b9eff12b982b15?pvs=204)
- **Repo-local detailed handoff prompt:** `docs/handoff/2026-11-06-kuota-ai-implementation-prompt.md` — use this instead of the short older prompt below.

The actual current plan files are `docs/superpowers/specs/2026-11-06-kuota-phase2-design.md` and the three `docs/superpowers/plans/2026-11-06-*.md` files; these take precedence over any older aspirational spec statements.

## 8. Copy-paste prompt for the next AI

**Updated:** The short prompt in this section is superseded by the complete [`2026-11-06-kuota-ai-implementation-prompt.md`](docs/handoff/2026-11-06-kuota-ai-implementation-prompt.md), which includes all updated user stories, 11 screen design references, actual H1 implementation, safety tests, history/forecast/optional cloud milestones and Google Drive/Notion URLs. For coding with Gemini or another AI, copy that full file, not just the paragraph below.

> You are implementing the **Kuota** project for HK. Work only in `/Users/hk/Dev/kuota` on HK's Mac mini. Start by reading `HANDOFF.md`, `docs/implementation-status-2026-11-05.md`, `docs/superpowers/specs/2026-11-06-kuota-phase2-design.md`, and `docs/superpowers/plans/2026-11-06-kuota-refresh-service.md`, then inspect actual TS source/tests. Do not assume roadmap items exist. Implement the **first unchecked task in the refresh-service plan only**, test-first, with minimal changes. Preserve `QuotaSnapshot` and CLI JSON schemaVersion 1, do not request or expose OAuth secrets, do not auto-login/read Keychain, do not contact cloud or Kunkun, do not push GitHub. Use Vite Plus scripts `bun run test`, `bun run typecheck`, `bun run check`, `bun run build`. Commit only after all checks pass. Report exact files, tests, commit and remaining tasks. If there are local user edits, inspect and preserve; ask before conflicts. Read the plan and observe stop conditions before writing code.

## 9. Open decisions to ask HK only when relevant

1. Should Kunkun plugin's host broker use bundled Deno TS code, Node runtime compatibility, or standalone executable? **Wait for K0 actual SDK discovery; do not ask prematurely.**
2. Should a future OS-wide cache be a local daemon, disk cache or hosted by Kunkun? Existing in-process service is enough to start; decide after measuring.
3. Does HK want to enable optional macOS Keychain read? This **requires explicit consent**, details and testing before implementing; disabled by default.
4. Does cloud history include only quota snapshots, or token/session activity from other agents? Different data product; design with KKTasks/Agent Observer rather than guessing.
5. Will the final packages be published under `kuota`, `@kunkunsh/kuota-*` or another scope? Name collision/license/registry decision required before publish, not before local dev.

---

**Reminder:** This file is a **handoff**, not a substitute for current source. On every future turn, re-run baseline and update the status section with observed results, especially for Claude authentication, upstream version drift and Kunkun SDK availability.
