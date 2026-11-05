# Kuota v0.1 — Product & Architecture Specification

Date: 2026-11-05 · Owner: HK · Status: implementation in progress

## Intent

Build a standalone, local-first TypeScript library, a scriptable command-line program, and a keyboard-first TUI for inspecting AI coding subscription quota. The future Kunkun plugin is a consumer of the library, not a dependency of it. The user's Mac mini at `/Users/hk/Dev/kuota` is the first integration/test environment.

Name `Kuota` is a working codename. The folder is `/Users/hk/Dev/kuota`; do not publish npm packages or register a remote repository until package/brand availability is confirmed.

## Non-negotiables

1. Bun workspaces monorepo, project-local Vite+ (`vite-plus`) providing `vp test`, `vp check`, `vp pack`. No global Vite+ install requirement.
2. TypeScript + Effect 3, `@effect/cli` and `@effect/platform-node` for the executable, typed provider errors and dependency injection. Effect 4 `effect/cli` is currently unstable; switching majors is a separate migration.
3. User-owned UniView React terminal renderer (`@uniview/tui-core`, `@uniview/tui-react`) for interactive TUI. React 19 aligns with Kunkun. Do not copy/reimplement UniView internals.
4. No credential material in logs, JSON output, UI, telemetry, exception messages, or snapshots. Never commit credentials. Access existing local credentials only through normal supported mechanisms and explicit runtime needs. Do not send tokens to Kuota servers.
5. Honest readings. An unsupported provider, logged-out account, stale cache, subscription quota, API credit balance, and locally inferred cost are different states and must not be conflated.
6. CLI `--json` has stable machine-readable output on stdout, diagnostic text only on stderr; noninteractive calls never initialize the terminal TUI. `kuota` with no args in a TTY may launch TUI; `kuota status` is scriptable.
7. Provider plugins are independent: no provider can read another provider's credential by construction; no user-space OS process sandbox claim in v0.1. Later Kunkun permission broker adds isolation.

## Topology

```text
packages/core         Effect Schema, snapshots, quota normalization, registry interfaces
packages/providers    codex/claude/antigravity implementations and provider-specific transport
packages/cli          @effect/cli, JSON/text commands, process entrypoint
packages/tui          UniView React TUI, refresh controls, provider cards
packages/kunkun       future plugin adapter — deliberately not implemented in v0.1
```

Dependencies: `core <- providers <- cli`; `core <- tui`; CLI dynamically imports TUI only when requested. Provider implementations are explicitly registered. No cyclic dependencies, no always-on daemon, no cloud database for this milestone.

## Snapshot contract

`QuotaSnapshot` includes provider ID, account identifier _when safe_, data source, `fetchedAt`, status (`ok`, `partial`, `unauthenticated`, `unavailable`, `unsupported`, `error`), time windows, optional money balances, and typed diagnostic code. It **must not** flatten all provider records into a single percent.

`QuotaWindow` includes exact `windowId` (`primary`, `secondary`, `weekly`, `model-specific`), `usedPercent` or `remainingPercent` (nullable; not both falsely inferred), optional `resetAt`, optional `limit` and `unit`, source freshness, and raw source name only for debugging. Normalize to the 0..100 range; invalid source fields become partial/unknown, not invented zero.

Provider read entrypoint: `readQuota(providerId, options): Effect.Effect<QuotaSnapshot, ProviderError>` in a service Layer or a narrow DI boundary. Every adapter has `id`, `capabilities`, `probe`, and `read`. Bulk reads return one result per requested provider and isolate failures, so one disabled account never breaks the entire dashboard.

JSON output envelope: `{schemaVersion:1, generatedAt, providers:[...], errors:[...]}`. Timestamps ISO 8601 UTC. Use documented stable IDs; add fields non-breakingly. `kuota status --json`, `kuota providers --json`, `kuota doctor --json` expected; unit-normalization and option parsing tested.

## Provider acquisition methods

| Provider                       | Preferred mechanism                                                                                         | Transport / auth                                                                                                 | Initial status & plan                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Codex                          | official local `codex app-server` JSON-RPC, methods `initialize`, `account/read`, `account/rateLimits/read` | launch existing Codex executable with timeout, write JSON-RPC lines, close subprocess, never log output blindly  | P0: integrate, macOS real test                                                                                                       |
| Claude Code                    | existing Claude Code OAuth token + `https://api.anthropic.com/api/oauth/usage`                              | explicit env or `~/.claude/.credentials.json` file, read-only HTTP; Keychain/PTY deferred                        | P1 implemented with mock HTTP; on Mac mini Claude is logged out (`claude auth status --json`), so live quota cannot be validated yet |
| Antigravity / agy              | structured `agy -p /usage --output-format json --print-timeout 90s` (>=1.1.11)                              | already signed-in agy; background auth browser guard, bounded output and process lifetime, auto-updates disabled | P1 implemented and verified live on agy 1.5.1; local language-server/HTTPS and OAuth sources are future adapters                     |
| OpenCode                       | provider-specific account/API or plugin status, if exposed                                                  | distinguish OpenCode Go subscription from underlying model API credits                                           | P2                                                                                                                                   |
| Gemini / GLM / Cursor / others | documented provider-specific API or safe local-state adapter                                                | per-provider review; no universal scraping fallback                                                              | P2                                                                                                                                   |

Do not casually clone CodexBar's implementation verbatim; inspect its license and reuse API discovery/ideas with proper attribution and tests.

## Codex app-server protocol constraints

- One subprocess per refresh in v0.1 is acceptable (later cache/persistent connection). Start with argument array, not interpolated shell.
- Message IDs are per session. Bound startup/total timeout; handle notifications, noisy stderr, partial stdout lines, protocol error responses, process exit, and cancellation.
- Send `initialize` then `initialized` notification; request account/rateLimits only after server is ready, as required by actual installed protocol. Parse only known contract fields; use fixture-based parser tests.
- Limit maximum line/message size to protect TUI and JSON memory. Never serialize `auth.json` or raw subprocess output to a log file.
- Respond to missing Codex executable, logged-out, disabled app-server, malformed payload, and timeout with specific status/error code.

## Claude / Antigravity uncertainty register

- Claude `claude -p /usage` and slash-command output are **not assumed** machine-readable. Claude OAuth endpoint is a private/undocumented subscription endpoint confirmed in CodexBar implementation and may change; avoid automatic Keychain UI, token refresh and PTY login for this first slice. Missing credentials return `unauthenticated`.
- Antigravity `agy` can start subprocesses. CodexBar's observed >=1.2.2 CSRF behavior makes its structured print mode preferable for a first CLI implementation. Calls run with process-group timeout/cleanup and a browser-launch guard. Local app/LSP probing is deferred.
- Account-level freshness is provider-specific. A successful process exit does not imply a valid quota snapshot.

## CLI UX

```text
kuota status [--provider codex|claude|antigravity] [--json]
kuota providers [--json]
kuota doctor [--json]
kuota tui               # keyboard-first UniView dashboard
kuota --help
```

`status` never prints fake 0%. Human text shows `unknown`, `unauthenticated`, `unavailable`, or percentage + next reset, always provider-qualified. `doctor` prints binary discovery and non-sensitive adapter presence only (no keychain item values). Current CLI exit code `0` indicates a successful status command even when a provider reports unavailable; consumers inspect `providers[].status`, while invalid options or CLI errors return nonzero.

## TUI design

- UniView React, terminal dark-adaptive, one compact header, refresh timestamp, cards for each provider with status/percent/reset time, one error line below a failed provider.
- `r` refresh; `1`/`2`/`3` filter providers; `a` show all; `q` exit. Compact 80x24; tolerate resize, narrow windows, and non-TTY by printing an actionable CLI fallback. Escape-key support is a follow-up.
- Refresh must not overlap. Dispose driver and restore terminal on error, Ctrl-C, and normal exit. Use sanitized provider/account text before rendering to prevent terminal control sequence injection.
- No credential entry in TUI first iteration.

## Packaging and Kunkun integration

- `@kuota/core` is portable and has no Node-only imports. `@kuota/providers` owns Node local-process/browser/keychain access and can be split per provider later.
- `@kuota/tui` is optional; importing `@kuota/core` into Kunkun must not bundle a terminal renderer or React.
- Kunkun plugin calls `readQuota` through its permission broker; permission manifest should request per-provider file/command/network access, no blanket filesystem read.
- Release later as `kuota` JS executable + optional compiled standalone binaries; allow `npx`/`bunx` without requiring end-user npm install. Before publishing, decide name and review npm scopes, package binaries and repository visibility.

## Acceptance for first slice

1. Mac mini worktree contains monorepo with package-local Vite+, Effect, UniView packages and documented startup.
2. Unit tests fail before implementation then pass; Vite+ tests, type check, build run and results reported accurately.
3. CLI `providers`, `doctor`, and `status --json` work locally; Codex provider tested with the real installed app-server, even if authentication unavailable.
4. TUI starts only with a real TTY; noninteractive command returns actionable error.
5. At least one test asserts that a stale/malformed quota cannot turn into `0%` remaining, and that no credential-shaped field leaks into JSON.
6. This spec and task-by-task plan are saved to Kunkun Google Drive, and their source links returned.

## References

- CodexBar research: https://drive.google.com/file/d/1WMTUBhUCU5krn5UYSTBxB0AWA24x4XKA/view?usp=drivesdk
- CodexBar provider index: https://drive.google.com/file/d/1d7rYqTB0SdFUZkO-N2PFN9sVoIgBHheV/view?usp=drivesdk
- UniView source: https://github.com/HuakunShen/uniview ; https://github.com/HuakunShen/uniview/blob/main/packages/tui-react/src/index.ts
- Effect stable CLI precedent in user's CrossCopy: `/Users/hk/Dev/CrossCopy/apps/tui/src/cli/root.ts`
- Effect CLI v4 documentation (unstable): https://effect.website/docs/v4/api/effect/cli/Command
- Vite+ local CLI: https://viteplus.dev/guide/local-cli
- Vite+ monorepo: https://viteplus.dev/guide/monorepo
- CodexBar original: https://github.com/steipete/CodexBar
