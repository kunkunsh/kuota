# @kunkun.sh/kuota

Truthful multi-provider AI subscription & quota suite: reusable TypeScript library, interactive TUI, headless CLI, and embedded loopback Web Workbench.

Supports **OpenAI Codex**, **Anthropic Claude Code**, and **Google Antigravity**.

---

## 🚀 CLI & Multi-Surface Usage

Run directly with zero installation via `npx`:

```bash
# 1. Interactive terminal TUI (full-screen UniView dashboard with % left & pace markers)
npx @kunkun.sh/kuota
npx @kunkun.sh/kuota tui

# 2. Web Workbench (embedded HTTP server + React 19 UI with 3D activity terrain & Dynamic Island)
npx @kunkun.sh/kuota web
npx @kunkun.sh/kuota web --port 5173 --no-open

# 3. Headless CLI commands (human readable or JSON)
npx @kunkun.sh/kuota status
npx @kunkun.sh/kuota status --json
npx @kunkun.sh/kuota doctor
npx @kunkun.sh/kuota pace
npx @kunkun.sh/kuota forecast
npx @kunkun.sh/kuota providers
```

---

## 📦 Library Usage

Install as a dependency in your application, server, or Kunkun extension:

```bash
npm install @kunkun.sh/kuota
# or
bun add @kunkun.sh/kuota
```

### 1. Unified AI Quota Parsers

Parse raw JSON / RPC payloads received from vendor CLIs or APIs into normalized, typed `QuotaSnapshot` structures:

```typescript
import {
  parseProviderQuota,
  parseCodexRateLimits,
  parseClaudeOAuthUsage,
  parseAntigravityUsageReport,
  type QuotaSnapshot,
} from "@kunkun.sh/kuota";

// Universal dispatcher:
const snapshot: QuotaSnapshot = parseProviderQuota("codex", rawVendorData);

// Or direct modular imports (browser & edge friendly):
import { parseCodexRateLimits } from "@kunkun.sh/kuota/parsers";
const codexSnapshot = parseCodexRateLimits(rawAppServerResponse);
```

### 2. Time Budget & Ideal Pace Calculation

Calculate linear time-budget pace without guessing:

```typescript
import { calculatePace, windowProfile } from "@kunkun.sh/kuota";

// Determine window cadence (e.g. 5h vs 7-day weekly)
const profile = windowProfile("codex", "primary", snapshot.windows[0].resetAt);

const pace = calculatePace({
  now: new Date(),
  startAt: new Date(Date.now() - 2 * 86_400_000),
  resetAt: new Date(snapshot.windows[0].resetAt!),
  usedPercent: snapshot.windows[0].usedPercent,
  semantics: profile.semantics,
  startSource: "provider",
});

if (pace) {
  console.log(`Ideal balance: ${pace.idealRemainingPercent}% remaining`);
  console.log(`Actual balance: ${100 - pace.actualUsedPercent}% remaining`);
  console.log(`Pace delta: ${pace.paceDeltaPoints > 0 ? "Ahead" : "Behind"} of pace`);
}
```

### 3. Live Provider Execution & Subprocess Service

Read quota directly from local installed developer tools (`codex`, `claude`, `agy`):

```typescript
import { readAll, readCodex, createQuotaService } from "@kunkun.sh/kuota";
import { Effect } from "effect";

// Execute all detected providers via Effect TS
const program = readAll(["codex", "antigravity"]);
const snapshots = await Effect.runPromise(program);

// Or create a managed cached service
const service = createQuotaService();
const cachedCodex = await service.read("codex");
```

---

## 🧩 Subpath Exports

| Import Path | Description |
| ----------- | ----------- |
| `@kunkun.sh/kuota` | Full library (Parsers, Metrics, History, Providers, Schemas) |
| `@kunkun.sh/kuota/parsers` | Pure data parsers (zero platform dependencies, Node & Browser safe) |
| `@kunkun.sh/kuota/metrics` | Linear pacing algorithms and forecasting models |
| `@kunkun.sh/kuota/history` | Append-only local JSONL journal and query engine |
| `@kunkun.sh/kuota/providers` | Subprocess adapters for Codex, Claude, and Antigravity |

---

## 🔒 Security and Data Honesty

- **Zero credential leaks**: API keys, tokens, session cookies, and private prompts are never stored, logged, or serialized.
- **Fail-safe status**: Unavailable or unauthenticated accounts are reported as `"unauthenticated"` or `"unavailable"` with honest error codes, never fabricated as `0% left`.
- **Shared peer dependencies**: Core dependencies like `effect` and `react` are not bundled into an opaque monolith, avoiding dual-package hazard in consumer apps.

---

## 📄 License

MIT © [Huakun Shen](https://github.com/HuakunShen)
