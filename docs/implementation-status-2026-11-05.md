# Kuota implementation verification — 2026-11-05

## Status and environment

- Mac mini workspace: `/Users/hk/Dev/kuota` (updated after directory rename)
- Toolchain: Bun 1.4.4, Node.js 24.13.0, Vite Plus 1.5.0, TypeScript 5.9.x, Vitest 5.1.0
- First-party machine packages: Codex CLI 0.147.0, Claude Code 2.1.63, agy 1.5.1
- Monorepo: `@kuota/core`, `@kuota/providers`, `@kuota/cli`, `@kuota/tui` (private; no registry publish)

## Verified behaviors

1. All workspace package builds with `bun run build` → 4/4 pass. The built Node CLI works with `node packages/cli/dist/main.mjs providers --json` after fixing exports to compiled `.mjs`.
2. `bun run test` → 7 suites, 32 tests passed (2026-11-05). Test approach: parse and transport fake server fixtures, subprocess timeout/malformed input, UniView MemoryCellSurface and Effect CLI JSON.
3. `bun run typecheck` → passed. `bun run check` → 32 files formatted, zero warnings or lint errors.
4. Codex live: JSON-RPC app-server `account/rateLimits/read`, primary quota verified (`usedPercent:37`, `remainingPercent:63` at test time).
5. Antigravity live: agy 1.5.1 print report, 5 measured quota buckets: Gemini weekly 94.67% remaining, Gemini 5h 81.34%; Claude/GPT weekly and 5h 100%; Gemini 4 Argon weekly 47.34% (all at 2026-11-05T21:23:07Z).
6. Claude fixture tests pass, but live login is unavailable: `claude auth status --json` → `{ "loggedIn": false, "authMethod": "none" }` and `~/.claude/.credentials.json` absent. CLI reports `unauthenticated:AUTH_REQUIRED`, not fake 0% quota.

## Provider implementation source and correspondence

| Provider | Kuota implementation | Research evidence | Caveats |
| --- | --- | --- | --- |
| Codex | `packages/providers/src/codex/protocol.ts`, `transport.ts`, `index.ts` | [Official Codex `GetAccountRateLimitsResponse`](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/GetAccountRateLimitsResponse.ts) | No API billing balances; subscription limits only. |
| Antigravity | `packages/providers/src/antigravity/index.ts` | [CodexBar agy documentation](https://github.com/steipete/CodexBar/blob/main/docs/antigravity.md), [parser](https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Antigravity/AntigravityQuotaSummaryParser.swift) and [fixture tests](https://github.com/steipete/CodexBar/blob/main/Tests/CodexBarTests/AntigravityCLIUsageReportTests.swift) | Print report has no account identity; no multi-account selection, local LSP or OAuth. Passive auth browser guard and auto-update suppression; no cached credential storage. |
| Claude | `packages/providers/src/claude/index.ts` | [CodexBar OAuth usage fetcher](https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Claude/ClaudeOAuth/ClaudeOAuthUsageFetcher.swift) and [credential model](https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Claude/ClaudeOAuth/ClaudeOAuthCredentialModels.swift) | Private endpoint, no reauthentication or Keychain UI; pending real account. |

## Remaining prioritized tasks

- Mac mini Desktop Commander terminal cannot allocate an interactive TTY (`script` reports `tcgetattr/ioctl: Operation not supported on socket`); human interactive TUI smoke remains to be run in Terminal.app. Non-TTY error handling is unit tested.
- Check agy subprocess descendant cleanup on long-running MCP child processes; current process-group cancellation is a best-effort first pass.
- Add non-interactive no-UI macOS Keychain access **only after explicit user consent** and an isolated security review, or a safe Claude PTY `/usage` fallback. Never store exported OAuth tokens in project files.
- Make optional refresh rate-limiting/cache per provider, account-aware identity and stale state; implement server-neutral Kunkun permission broker bridge.
- Reconcile design/spec and Drive copies; decide whether to publish a new GitHub repo and npm scope after approval.

Google Drive: [Project folder](https://drive.google.com/drive/folders/1tbFYypqi8QTF7TCX4TMKdUB96Dt_uxvi).
