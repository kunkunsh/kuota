# Kuota Provider Methods and Reliability Research

- **Updated:** 2026-11-06
- **Status:** Source-backed engineering synthesis, not an assertion every candidate provider works
- **Primary inspiration:** [steipete/CodexBar](https://github.com/steipete/CodexBar)
- **Related inventory:** [CodexBar 111 Provider Methods (Drive)](https://drive.google.com/file/d/1d7rYqTB0SdFUZkO-N2PFN9sVoIgBHheV/view), [CodexBar in-depth research (Drive)](https://drive.google.com/file/d/1WMTUBhUCU5krn5UYSTBxB0AWA24x4XKA/view)

## Executive recommendation

Do **not** search for one universal quota command. For subscription coding agents, the authoritative measurement may come from a local JSON-RPC app-server (Codex), a local CLI's structured print command (Antigravity), an authenticated vendor web endpoint (Claude), an IDE service, or an undocumented app-internal RPC. Kuota should use **independent per-provider adapters**, normalize only measured windows, surface source/freshness/auth states, and never silently request a new login. It is a reusable library first, then CLI/TUI, then a Kunkun plugin.

### Methods side by side

| Agent/vendor               | Reliable method identified for current Kuota                                     | Authentication                                             | Execution                               | Proven?                                      | Risks                                                                   |
| -------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| OpenAI Codex CLI           | `codex app-server` with `initialize` / `initialized` / `account/rateLimits/read` | Installed Codex CLI's local existing session               | Spawn JSONL process, bounded; no prompt | **Live tested** on user's Mac mini           | Protocol/version drift, process timeout, account switch                 |
| Claude Code                | Existing Claude subscription OAuth token → `GET /api/oauth/usage?cedar_ember=1`  | `CLAUDE_CODE_OAUTH_TOKEN` or `~/.claude/.credentials.json` | HTTP GET, bounded, no token refresh     | **Fixture tested only**; Mac mini logged out | Private endpoint/headers, 401/429, Keychain auth prompts                |
| Google Antigravity (`agy`) | `agy -p /usage --output-format json --print-timeout 90s`                         | Existing agy session                                       | CLI print, bounded child and output     | **Live tested** on Mac mini agy 1.5.1        | Version dependency, 20s cap, no account ID in print payload, child tree |
| OpenCode Go                | Unknown account-specific subscription mechanism                                  | Depends on provider                                        | Discovery required                      | **Not implemented / unverified**             | OpenCode's model token API is not necessarily Go-plan quota             |
| Cursor                     | Provider/IDE-specific local account state or endpoint                            | Existing IDE auth                                          | Discovery required                      | **Not implemented / unverified**             | Private web endpoints and UI-only quotas                                |
| Gemini CLI                 | CLI/service-specific quota signal; distinguish AI Pro web plan from CLI plan     | Vendor auth                                                | Discovery required                      | **Not implemented / unverified**             | Request counts differ from tokens/web-chat quota                        |
| GLM Coding Plan            | Provider-specific plan quota/status                                              | Vendor auth                                                | Discovery required                      | **Not implemented / unverified**             | Subscription vs API credit conflation                                   |
| Qoder CN/International     | Region-specific credit accounting                                                | Vendor auth                                                | Discovery required                      | **Not implemented / unverified**             | Credits not comparable across regions                                   |
| Windsurf / Copilot / Warp  | Product-specific status API, app session, or plan settings                       | Vendor auth                                                | Discovery required                      | **Not implemented / unverified**             | Auth/ToS; missing stable machine API                                    |

**No universal `usage` field:** The three implemented providers use different semantics and cadence. Codex's primary/secondary, Claude's five-hour/seven-day utilization, and agy's model-group windows must retain distinct stable `windowId`s. A single global percent across products would be meaningless.

## 1. Codex — structured JSON-RPC from app-server

**Evidence:** Official [OpenAI Codex App Server rate-limit response TS schema](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/GetAccountRateLimitsResponse.ts); Kuota `packages/providers/src/codex/{protocol,transport,index}.ts` and fixture tests.

Sequence:

1. Start existing `codex` executable with argument `app-server` and stdin/stdout/stderr pipes, no shell.
2. Write a JSONL request `{"id":1,"method":"initialize","params":{"clientInfo":{"name":"kuota","version":"0.1.0"}}}`.
3. Upon successful id=1 response, send the `initialized` notification.
4. Send `{"id":2,"method":"account/rateLimits/read"}`.
5. Parse id=2 response, ignoring notifications; normalize primary/secondary/credits when truly present. Use 15s default total timeout; terminate child and consume stderr without logging.

Why this method: typed machine-to-machine protocol exposed by the existing installed application, no login automation or prompt consumption. It reports **Codex subscription rate limits**, not general OpenAI API invoices or ChatGPT web UI quota. `account/read` may expose account identity if explicitly needed later; this is **not currently queried by Kuota**. A new CLI invocation currently launches a new app-server, so polling frequency matters.

Verified behavior on Mac mini 2026-11-05: rate-limit response parsed to normalized windows; primary used 37%, remaining 63% _at that test instant_, not a permanent value. `codex --version` was 0.147.0 at baseline.

Failure classes: binary missing, child exits before handshake, malformed/interleaved JSONL, oversized stdout, timeout, missing response, no account. Never replace missing quota by 0%; unknown fields become unknown/partial. A future persistent session might reduce spawn overhead but adds lifecycle state; consider only after measuring.

## 2. Claude Code — private OAuth subscription usage endpoint

**Evidence:** [CodexBar OAuth Usage Fetcher](https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Claude/ClaudeOAuth/ClaudeOAuthUsageFetcher.swift), [credential models](https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Claude/ClaudeOAuth/ClaudeOAuthCredentialModels.swift), Kuota `packages/providers/src/claude/index.ts`, associated fixture tests.

Current request: `GET https://api.anthropic.com/api/oauth/usage?cedar_ember=1`, with `Authorization: Bearer <existing Claude Code subscription OAuth token>`, `Accept: application/json`, `anthropic-beta: oauth-2025-04-20`. If the first request yields 400/403, Kuota tries the base `/api/oauth/usage` once. These are **private/undocumented** vendor methods; they may change without notice. An Anthropic API key is not equivalent to a Claude subscription OAuth token.

Token sources currently accepted: explicit `options.token`, then `CLAUDE_CODE_OAUTH_TOKEN`, then `~/.claude/.credentials.json`'s `claudeAiOauth.accessToken` if not expired. **Issue:** explicit `options.credentialsFile` currently sits after env; should be authoritative when supplied, to avoid using a different account inadvertently. Do not log credentials or automatically read macOS Keychain or sign in. The Mac mini's `claude auth status --json` was `loggedIn:false` and no local credentials file was available; Claude data is parser/transport fixture-tested **but not live verified**.

Response fields observed by source and modeled in Kuota:

| Upstream data                         | Normalized ID                   | Semantics                         |
| ------------------------------------- | ------------------------------- | --------------------------------- |
| `five_hour.utilization`               | `session.5h`                    | Used % for rolling 5h window      |
| `seven_day.utilization`               | `weekly.all`                    | Used % 7d aggregate               |
| `seven_day_oauth_apps.utilization`    | `weekly.oauth-apps`             | Alternate weekly OAuth app window |
| `seven_day_sonnet` / `seven_day_opus` | `weekly.sonnet` / `weekly.opus` | Optional model-family bucket      |
| `limits[]` with `kind:weekly_scoped`  | `weekly.{normalized-model-id}`  | Model-specific buckets            |
| `resets_at`                           | `resetAt`                       | ISO-ish reset time; must validate |

0% used means 100% remaining. Missing field is **unknown**, not unlimited. Token expiry, 401, 429, 500, body cap, timeout are separate conditions. **429 must not be met by proxy hopping or aggressive retries**; conservative backoff avoids further account trouble. Current HTTP timeout ~12s, maximum parsed body 1MiB, `redirect:"error"`.

Alternatives weighed:

- `claude auth status --json`: safe to check login state, **does not provide actual quota windows**.
- `claude` interactive `/usage` via PTY: potential fallback but non-machine stable; demands terminal automation and may interact with session; not MVP default.
- macOS Keychain: may contain Claude app OAuth data, but generic reads may prompt UI/permission. Consent + isolated host helper/security review required. Do not attempt silently.
- Claude API spend/billing API: different metric from Max/Pro subscription quota; avoid conflation.

## 3. Antigravity agy — structured print, not LSP scraping

**Evidence:** [CodexBar Antigravity integration guide](https://github.com/steipete/CodexBar/blob/main/docs/antigravity.md), [quota parser](https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Antigravity/AntigravityQuotaSummaryParser.swift), [fixture tests](https://github.com/steipete/CodexBar/blob/main/Tests/CodexBarTests/AntigravityCLIUsageReportTests.swift), Kuota `packages/providers/src/antigravity/index.ts` and tests.

Command sequence:

```bash
agy --version
agy -p /usage --output-format json --print-timeout 90s
```

Current Kuota requires agy >=1.1.11; executes with an external ~20s timeout (so the `--print-timeout 90s` argument is not a guarantee of 90-second execution). Auto-update disabled for child `AGY_CLI_DISABLE_AUTO_UPDATE=true`; `open`, `xdg-open`, and `$BROWSER` are redirected to a no-op/fail private launcher in a temp directory to avoid a passive probe opening an auth browser. It intentionally clears `ANTIGRAVITY_OAUTH_CREDENTIALS_JSON` from child env. One MiB stdout cap and process-group SIGTERM cleanup protect the terminal, but descendant SIGKILL/cleanup is still worth hardening.

Parser structure: response `status:SUCCESS`, `command.name:"usage"`, `command.data.groups[]`, each group with `buckets[]`. Buckets provide fractions `remaining_fraction`, nested `remaining.remaining_fraction` or `remaining.case:"remainingFraction"/value`, which represent **remaining fraction 0..1**. Convert to `usedPercent=(1-fraction)*100`, round to two decimals; normalize resets and group-specific window IDs. Exclude disabled buckets; retain separate model families. Version suffix parsing is conservatively rejected.

Mac mini agy 1.5.1 live read on 2026-11-05 returned 5 separate quota buckets. Percentages change over time; see `docs/implementation-status-2026-11-05.md` for test-time numbers. **Current structured print response does not supply reliable account identity**, so a durable cache keyed only by provider is unsafe for switching accounts. Do not invent an email or token-derived cache key. CodexBar describes additional local IDE/LSP/HTTP probing, but these require deeper trust/risk analysis; structured print is lowest-complexity for standalone CLI.

## 4. Subscription quota vs actual usage vs costs

| Concept                     | Example                                                                    | Can Kuota currently report reliably?                         |
| --------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Quota remaining             | Codex primary 63% remaining or Claude 5h used%                             | Yes, when authenticated measurable upstream fields exist     |
| Reset time                  | 5h/weekly reset                                                            | Yes when source provides valid `resetAt`; otherwise null     |
| Session token usage         | Number of input/output/cache tokens for an individual Codex/Claude session | **No** — requires session log/agent telemetry integration    |
| Subscription plan price     | Claude Max $200, Codex included limits                                     | Not inferred from percentage; pricing is external/unverified |
| API account billing balance | Credit dollars or spent dollars                                            | **No** in existing three adapters                            |
| Background agent activity   | Current task running, project, session title, progress                     | **No** — belongs to KKTasks/Agent Observer                   |
| Cross-device history        | Daily quota curve, weighted usage trends                                   | **No** — requires opt-in collection and Kunkun sync design   |

This distinction matters for Kunkun dashboard design: avoid a large "total quota" gauge across incomparable products. Prefer separate provider/model rows; show unknown as an explicit state.

## 5. Design decisions and rejected shortcuts

1. **No universal shell scraping:** `claude -p /usage` cannot be assumed to parse; agy print has a structured contract, Codex app-server offers typed JSON-RPC.
2. **No implicit login:** a monitoring command should not consume quota, open browsers, rotate credentials, launch OAuth consent, or prompt Keychain.
3. **No silent 429 workaround:** honor cooldown rather than rotating proxies to get around vendor enforcement.
4. **No shared SQLite full access across providers/plugins:** future Kunkun storage must enforce plugin namespace and user opt-in; vendor credentials never enter database.
5. **No fake zero:** `unavailable` is not exhaustion. Null percentage is unknown, `0` remaining is an actual source measurement.
6. **No cross-process TTL claim:** a library cache only lives as long as its process; a daemon/disk cache requires a later architecture choice.
7. **No Kunkun coupling in core:** provider adapter can later serve CLI, UniView, Kunkun and other consumers.

## 6. Future provider research queue, prioritized

**P1:** OpenCode Go vs upstream provider; Claude multi-account identity; Codex account/plan metadata; agy reliable identity availability. **P2:** Gemini CLI, GLM Coding Plan, Qoder CN/int'l, Cursor, Copilot, Warp. **P3:** API billing and token history as separate namespace.

For **every** new provider, research in this exact order:

1. Identify plan type and user story (subscription allowance, token spend, free allowance, model-specific cap).
2. Search primary official docs/SDK/CLI schema and current open-source implementations; cite exact files and commit hashes.
3. Determine preexisting auth source and whether read can be performed noninteractively **without modifying session**.
4. Determine endpoint/command stability, version bounds, response schema, resets, rate-limit rules, account identity.
5. Score side effects and security (login risk, Keychain UI, raw token exposure, subprocess spawning, untrusted stdout).
6. Create redacted fixture samples (never real token). Implement parser before transport. Test 0, null, missing, 429, malformed, and reset semantics.
7. Add provider registry metadata and capability manifest only when validated. Mark unsupported as unsupported.
8. Run one respectful live test with a user-owned signed-in account, or explicitly label fixture-only; do not assume success from a README.

Template provider research record:

```yaml
provider: candidate-name
product_plan: unknown
metric_scope: subscription|api-billing|token-usage|activity
verified_primary_source: URL-or-unverified
method: command|app-server|official-api|private-api|local-file|ide-rpc
auth_source: existing-session-only
account_identity: available|not-available|unverified
probe_side_effects: none|process|browser-risk|auth-risk
quota_windows: []
reset_semantics: unknown
rate_limit: unknown
transport_timeout_ms: TBD
response_size_cap: TBD
tested_fixture: false
tested_live: false
status: research-only
```

## 7. Source provenance and unverified areas

- Source-level verified: Kuota actual local code (paths above); the external source files linked above and prior CodexBar research notes; earlier live Mac mini results recorded in implementation status.
- Unverified in this session: latest CodexBar commit hash and star count; complete inventory of every vendor implementation after latest release; exact Kunkun v2.1 plugin ABI; full Claude logged-in response on this machine; whether macOS Keychain item is present; OpenCode Go, Cursor, GLM and Qoder quota read paths.
- When using the prior [CodexBar 111 methods research](https://drive.google.com/file/d/1d7rYqTB0SdFUZkO-N2PFN9sVoIgBHheV/view), treat it as a candidate taxonomy, **not proof** Kuota supports all 111. Re-verify each provider against upstream primary source before implementation.

## 8. Implementation reference map

| Question                              | Read this                                                       |
| ------------------------------------- | --------------------------------------------------------------- |
| Current features and baseline         | `docs/implementation-status-2026-11-05.md`                      |
| Phase 2 public behavior and security  | `docs/superpowers/specs/2026-11-06-kuota-phase2-design.md`      |
| TTL/singleflight/rate limiting        | `docs/superpowers/plans/2026-11-06-kuota-refresh-service.md`    |
| Claude, Codex, agy hardening          | `docs/superpowers/plans/2026-11-06-kuota-provider-hardening.md` |
| Future Kunkun/React/permissions/cloud | `docs/superpowers/plans/2026-11-06-kuota-kunkun-integration.md` |
| Next AI handoff                       | `HANDOFF.md`                                                    |

**License note:** CodexBar is a research reference. Independently implement behavior from documented interfaces and fixture tests; check its repository license and preserve attribution before copying any code. UniView remains HK's own reusable package; do not duplicate its renderer implementation.
