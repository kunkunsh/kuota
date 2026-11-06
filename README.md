# Kuota

Local-first AI coding subscription quota monitor: reusable TypeScript library, Effect CLI, and UniView React TUI. Kunkun integration is planned, not coupled to this workspace.

## Quick start

Requires Bun (for development), Node 24+, and existing provider CLIs. All project tooling, including Vite Plus, is installed **locally**, not globally.

```bash
cd /Users/hk/Dev/kuota
bun install
bun run build
bun run test
bun run typecheck
bun run check

bun run cli -- providers
bun run cli -- doctor
bun run cli -- status --json
bun run cli -- status --provider codex --json
bun run cli -- status --provider antigravity --json
bun run tui

# The built CLI also runs with Node (no Bun runtime requirement):
node packages/cli/dist/main.mjs providers --json
node packages/cli/dist/main.mjs status --provider codex --json
```

`status` reports each provider independently; an unavailable or logged-out account is **not** displayed as 0% remaining. `--json` emits one machine-readable envelope: `schemaVersion`, `generatedAt`, `providers[]`, and `errors[]`. `doctor` only detects installed executables and implemented adapters; it does not guarantee sign-in. TUI keyboard controls: `r` refresh, `q` quit, `1` Codex, `2` Claude, `3` Antigravity, `a` all.

## Provider support

| Provider          | Source                                                                                            | State and limitations                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex             | Existing `codex app-server`, `account/rateLimits/read`                                            | Tested live on macOS. Uses the app-server JSON-RPC initialization handshake; doesn't send model prompts.                                                                                                          |
| Antigravity / agy | Existing `agy -p /usage --output-format json --print-timeout 90s`                                 | Tested live on macOS with agy 1.5.1. Requires version >=1.1.11 and an already signed-in CLI. Preserves separate Gemini, Claude/GPT, and model-specific 5h/weekly buckets.                                         |
| Claude Code       | Existing subscription OAuth token from `CLAUDE_CODE_OAUTH_TOKEN` or `~/.claude/.credentials.json` | Implemented and fixture-tested, but **not live-authenticated** on Mac mini. `claude auth status --json` reports `loggedIn:false`. Keychain access, token refresh and PTY `/usage` are deliberately unimplemented. |

Claude Code credentials are not the same as an Anthropic API key. Kuota reads Claude's private subscription usage endpoint, which may change without notice; after a 429, wait before refreshing. `claude auth status --json` can be used to check login, but signing in is a separate user action.

## Architecture

```text
packages/core       Effect Schema, typed quota normalization and redaction, no Node imports
packages/providers  Isolated Codex, Claude, agy adapters + Effect registry
packages/cli        @effect/cli (human-readable + JSON + doctor)
packages/tui        @uniview/tui-core + @uniview/tui-react with keyboard input
docs/specs          Architecture and provider research
docs/superpowers    Stepwise implementation plan
```

Each package uses Vite Plus `vp pack`; workspace builds run in dependency order. Core and provider packages export their TypeScript source under the Bun condition for local development and built `.mjs` under the default condition for Node. Build before using Node's distributed entrypoint.

Future Kunkun plugin should call `@kuota/providers` through its permissions broker; do not give a WebView direct access to terminal credentials. UniView is an optional consumer, not a core dependency.

## Security and data honesty

- Tokens, cookies, raw HTTP error bodies, raw app-server/agy output, and credential diagnostics never appear in snapshots or JSON output.
- No credential rotation or implicit login; agy auto-update is disabled per child process and browser launcher commands are guarded during passive probes.
- Provider subprocesses and HTTP calls are bounded by time and output size; each provider failure is isolated from others.
- No Kunkun service, cloud storage, account sync, analytics, or background daemon in this first version.
- Compiled packages have not been published to npm or pushed to GitHub yet.

## Design references

- **[AI implementation handoff](HANDOFF.md)** — actual implementation status, next-agent instructions, safety/approval gates, verification and prompts.
- [Phase 2 architecture and product design](docs/superpowers/specs/2026-11-06-kuota-phase2-design.md) — proposed refresh service, security, Kunkun path and history decision.
- [Phase 2: refresh service implementation tasks](docs/superpowers/plans/2026-11-06-kuota-refresh-service.md), [provider hardening tasks](docs/superpowers/plans/2026-11-06-kuota-provider-hardening.md), [Kunkun integration tasks](docs/superpowers/plans/2026-11-06-kuota-kunkun-integration.md).
- [Detailed provider methods and tradeoffs](docs/research/2026-11-06-kuota-provider-research.md).
- [Google Drive `projects/kuota`](https://drive.google.com/drive/folders/10RVDLtwfJGPQnI9sX5LKpkqGVqLdXdU5).
- [CodexBar](https://github.com/steipete/CodexBar) and its [Antigravity](https://github.com/steipete/CodexBar/blob/main/docs/antigravity.md) / [Claude](https://github.com/steipete/CodexBar/blob/main/docs/claude.md) provider documentation.
- [UniView](https://github.com/HuakunShen/uniview)
- [Vite Plus monorepos](https://viteplus.dev/guide/monorepo) and [package builds](https://viteplus.dev/guide/pack)
- [Kuota research/spec folder (Google Drive)](https://drive.google.com/drive/folders/1tbFYypqi8QTF7TCX4TMKdUB96Dt_uxvi)
