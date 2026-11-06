# Kuota Provider Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve correctness and security of the three existing provider adapters without automating login, exposing credentials, or relying on undocumented quota estimates.

**Architecture:** Keep Codex JSON-RPC, agy noninteractive `/usage` print, and Claude existing OAuth-token read as separate Effect-based I/O adapters. Add deterministic fixtures, clean cancellation, bounded retry semantics, a strict credential source policy and operator diagnostics. Access to macOS Keychain is a separately approved optional milestone, not a side effect of this plan.

**Tech Stack:** TypeScript/Effect, Vite Plus/Vitest, Node `child_process`, web `fetch`, macOS Terminal.app/manual smoke.

**Spec:** [`docs/superpowers/specs/2026-11-06-kuota-phase2-design.md`](../specs/2026-11-06-kuota-phase2-design.md).

## Global Constraints

- Existing adapters and fixtures take precedence over snippets in this plan. No model prompts, payment/billing changes, signup, browser login, proxy rotation on 429, or Keychain access without explicit consent.
- Preserve `QuotaSnapshot` and CLI JSON version 1, no raw response data in errors or diagnostics.
- A real Claude account **was not logged in** on the Mac mini at baseline; tests must be fixture-based until user logs in voluntarily.
- Verify Vite Plus `vp test run`, `vp check`, `vp run -r build` through existing `bun run` scripts.
- Red-before-green, commit each self-contained task, record live verification without account identifiers.

## Review Focus

Provider schema drift; credential precedence and leak paths; timeouts and aborts; spawn tree cleanup; private endpoint 401/403/429; local and online quota semantics; reset clocks; accidental auth mutation; output caps; fixture resilience; no cross-provider failures.

---

## Task 0 — Inventory and guardrails

**Read:** `packages/providers/src/codex/{protocol,transport,index}.ts`, `packages/providers/src/claude/index.ts`, `packages/providers/src/antigravity/index.ts`, matching `*.test.ts` and `docs/research/2026-11-06-kuota-provider-research.md`.

- [ ] `git status --short`, `bun run test`, `bun run build`, `bun run typecheck`, `bun run check` baseline.
- [ ] Count existing provider fixture coverage, identify unhandled states by constructing a matrix: authenticated, logged-out, empty success, malformed JSON, timeout, network failure, rate-limited, version unsupported.
- [ ] Confirm `CLAUDE_CODE_OAUTH_TOKEN` is not being logged in test output. Do not print or decode credential values during inventory.

## Task 1 — Make Claude credential selection deterministic

**Files:** `packages/providers/src/claude/index.ts`, `claude.test.ts`.

Current logic: `options.token` → `process.env.CLAUDE_CODE_OAUTH_TOKEN` → `options.credentialsFile ?? default`. Proposed logic: `options.token` → explicit `options.credentialsFile` → environment → default. An explicitly supplied but missing or invalid `credentialsFile` should **not silently fall through to another account's environment token**. This matters in multi-account testing and privacy.

**Implementation sketch:**

```ts
async function resolveToken(options: ClaudeOptions): Promise<string | null> {
  if (options.token !== undefined) return options.token.trim() || null;
  if (options.credentialsFile !== undefined) {
    return safeReadCredentialFile(options.credentialsFile); // no fallback
  }
  const env = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (env?.trim()) return env.trim();
  return safeReadCredentialFile(join(homedir(), ".claude", ".credentials.json"));
}
```

- [ ] RED: explicit token overrides file/env. Explicit `credentialsFile` overrides env. Missing/expired explicit file returns `AUTH_REQUIRED` instead of falling back. Environment overrides implicit default file. Whitespace/garbage tokens return unauthenticated, not a fetch.
- [ ] RED: `.credentials.json` expiry tests include time-skew boundary (`expiresAt <= now + 60_000` rejects, if adopting 60s skew); API-key-looking values cannot masquerade as Claude subscription OAuth.
- [ ] GREEN: extract a small safe resolver; avoid exporting token resolving API accidentally. Tests should inject fake file path and env using proper restoration, never real secrets.
- [ ] Run focused/full tests and commit `fix(claude): make quota credential precedence explicit`.

## Task 2 — Claude HTTP finite-state behavior

**Files:** `packages/providers/src/claude/index.ts`, `claude.test.ts`.

Current private request is `GET https://api.anthropic.com/api/oauth/usage?cedar_ember=1`, header `anthropic-beta: oauth-2025-04-20`, fallback to base URL after 400/403. Preserve this research-derived behavior as an **undocumented** integration, not an official API contract. Do not fetch external sources in tests.

- [ ] RED 200: both 5h and 7d recognized, model limits separated, `utilization:0` means 100% remaining, `utilization:100` means 0% remaining, missing usage means `NO_MEASURED_QUOTA`, never assume unlimited.
- [ ] RED 401: `unauthenticated/AUTH_REQUIRED`; 429: stable `RATE_LIMITED`, no response body. 500: `HTTP_ERROR`; network error: `NETWORK_ERROR`; abort: `TIMEOUT`; oversized body: `OUTPUT_TOO_LARGE`.
- [ ] RED 400/403: exactly one fallback to base endpoint; no retry cascade on 401 or 429; abort signal shared across both attempts.
- [ ] RED parser: invalid percentages (negative, >100, `NaN`, strings) skipped; malformed resets become null; weird model name is slugged, duplicate model buckets de-duped; unknown fields ignored.
- [ ] RED security: fixture with bearer token and raw error secret string produces **no secret** in JSON, stdout or thrown Error.
- [ ] GREEN: minimal parser/transport adjustments. Keep `redirect:"error"`, bounded response and 12s default timeout.
- [ ] Document upstream drift and commit `test(claude): harden subscription usage parser and HTTP failures`.

## Task 3 — Codex protocol robustness

**Files:** `packages/providers/src/codex/protocol.ts`, `transport.ts`, `codex.test.ts`.

Codex is a structured app-server handshake, **not** a one-shot `codex usage` command or an API-key billing query. It currently sends `initialize` (id 1), then `initialized` + `account/rateLimits/read` (id 2). The remote protocol is versioned and may add notifications.

- [ ] RED: app-server returns an initialization notification between response messages; transport ignores notifications and still parses read response.
- [ ] RED: partial JSONL across chunks, multiple complete lines in one chunk, 2MiB bound, malformed response, missing result, wrong response ID, process early exit, binary missing.
- [ ] RED: process lifetime bounded (15s default) and no raw stdout/stderr on error; sub-process terminated and pipes closed on success, timeout, and failure.
- [ ] RED parser: primary/secondary windows kept distinct, value shapes from official `GetAccountRateLimitsResponse` fixture; absent rate limits produce unknown/unavailable rather than fabricated zero.
- [ ] GREEN: minimal changes to transport; if changing RPC protocol, link to the exact official TypeScript schema commit and test the new shape.
- [ ] Commit `test(codex): harden app-server protocol framing and cleanup`.

## Task 4 — agy subprocess tree cleanup and report parsing

**Files:** `packages/providers/src/antigravity/index.ts`, `antigravity.test.ts`.

Current adapter starts `agy --version`, then `agy -p /usage --output-format json --print-timeout 90s`, enforced external ~20s deadline, version >=1.1.11; `AGY_CLI_DISABLE_AUTO_UPDATE=true`, temp PATH browser wrappers, no auth env injection, 1MiB stdout. Do not remove these passive-probe guards without equivalent security review.

- [ ] RED: fixture report with Gemini 5h/weekly, Claude/GPT buckets, Gemini model-specific 5h/weekly; parse fraction as remaining and convert to used %. `0` is valid exhausted, `1` is fully remaining, >1 invalid.
- [ ] RED: optional/disabled bucket skipped, duplicate window names disambiguated, missing `groups` is protocol error; `status:SUCCESS` without measured buckets fails explicitly.
- [ ] RED: CLI missing returns `BINARY_NOT_FOUND`, unsupported version returns `UNSUPPORTED_VERSION`, no login returns `AUTH_REQUIRED`, malformed JSON returns `PROTOCOL_ERROR`, timeout `TIMEOUT`, oversized stdout `OUTPUT_TOO_LARGE`.
- [ ] RED with local fake child executable: normal exit, timeout, nested subprocess that ignores parent termination. On timeout first SIGTERM process group then bounded SIGKILL after grace, scoped only to the spawned process group; prevent PID reuse risk and cleanup listeners/timers. Do **not** kill other agy sessions.
- [ ] RED: `open`, `xdg-open`, and `$BROWSER` launch attempts from fake executable fail fast; upstream output never leaks stdout/stderr to Kuota JSON.
- [ ] GREEN: narrow spawn/kill changes; use `try/finally` temp-directory cleanup and assure all async cleanup settles. On Windows, preserve safe behavior instead of assuming `process.kill(-pid)` works.
- [ ] Commit `fix(agy): bound print probe and descendant cleanup`.

## Task 5 — Doctor diagnostics: capability vs auth

**Files:** `packages/cli/src/commands.ts`, `commands.test.ts`, `README.md`.

Current `kuota doctor` only checks `PATH` binary presence and adapter flag; it explicitly does **not** prove sign-in. Extend only if safe and useful:

- [ ] RED: missing CLI recognized, `--json` stdout is a parseable object with no side effects.
- [ ] RED: on macOS, Claude logged-out does not launch browser or scrape secret file. `doctor` must not force quota fetch or inspect credential content merely to show "present".
- [ ] GREEN: if implementing deeper capabilities, introduce explicit `doctor --probe` which calls safe passive read and remains opt-in. Keep default `doctor` lightweight and privacy-preserving.
- [ ] Update docs with reason for `AUTH_REQUIRED`, version unsupported, privacy and usage reset semantics.
- [ ] Commit `docs(cli): clarify doctor capability and auth checks` (or code+test commit if changed).

## Task 6 — Live verification with user-controlled credentials

- [ ] Run locally `bun run cli -- status --provider codex --json`: verify fields and sanitized output, do not copy account details into docs.
- [ ] Run `bun run cli -- status --provider antigravity --json`: verify each model bucket and no browser opens, avoid too-frequent calls.
- [ ] Check only `claude auth status --json` (safe) to determine if the user has already logged in. If logged out, leave live Claude verification untested and write that clearly. **Never run login automatically.**
- [ ] If Claude is already logged in: one quota read, verify OAuth path; do not print tokens, do not repeat on 429. Log provider status but not request payload.
- [ ] On macOS Terminal.app, test interactive `bun run tui` manually; remote commander cannot allocate working TTY in this setup.
- [ ] Full regression `bun run test`, `bun run typecheck`, `bun run check`, `bun run build`; record exact counts and versions.

## Optional Task K — Keychain access proposal, **BLOCKED FOR CONSENT**

**Do not execute unless HK explicitly approves a Keychain read path after reviewing this section.**

Claude Code on macOS may keep its OAuth secret in Keychain rather than `~/.claude/.credentials.json`. Querying the Keychain using generic CLI helpers can trigger an interactive permission dialog, and a background polling tool must not do so without consent. Preferred design after approval: an optional native helper that uses macOS Security.framework (`SecItemCopyMatching`, UI explicitly disabled, read only, Keychain service/account selectors derived from verified Claude Code behavior). An unsupported or denied lookup returns `AUTH_REQUIRED`, not a prompt or a request to weaken Keychain ACL. All token bytes remain inside the host process, never in Deno WebView/renderer or diagnostic outputs. A simple `security find-generic-password -w` command is **not** automatically safe to run unattended; do not assume no UI.

Security checklist before unlock: verified exact Keychain item identifiers and ownership; deny-by-default CLI flag or config; consent UX; OS access-control behavior tested on sacrificial account; no logging; no analytics; no credential persistence; non-macOS behavior; degraded error state. **Never request HK to paste OAuth tokens into chat.**

## Completion criteria

- [ ] All three adapter fixture matrices cover missing/auth/timeout/limit/protocol cases.
- [ ] Explicit Claude file selection cannot read an unrelated env account by fallback.
- [ ] No prompts, auto-update, OAuth refresh, Keychain dialogs or secret disclosures.
- [ ] `agy` orphaned processes addressed and empirically verified without collateral termination.
- [ ] `status --json` schema 1 and per-provider isolation preserved.
- [ ] All baseline 32 tests plus new tests, build/check/typecheck pass.
- [ ] Live verification status and any manual-only checks recorded faithfully; no invented Claude success.
