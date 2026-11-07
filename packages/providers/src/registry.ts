import { Effect } from "effect";
import {
  type BillingModel,
  makeUnavailableSnapshot,
  type ProviderId,
  type QuotaSnapshot,
} from "@kuota/core";
import { readCodex } from "./codex/index.js";
import { readAntigravity } from "./antigravity/index.js";
import { readClaude } from "./claude/index.js";
import { opencodegoProvider } from "./opencodego/index.js";
import { openrouterProvider } from "./openrouter/index.js";
import { deepseekProvider } from "./deepseek/index.js";
import { mimoProvider } from "./mimo/index.js";
import { kimiProvider } from "./kimi/index.js";
import { glmProvider } from "./glm/index.js";
import { minimaxProvider } from "./minimax/index.js";
import { grokProvider } from "./grok/index.js";
import type { ProviderCategory } from "./adapter.js";

export interface QuotaProvider {
  id: ProviderId;
  label: string;
  read: () => Effect.Effect<QuotaSnapshot, unknown>;
  billingModel?: BillingModel;
  category?: ProviderCategory;
  envKeys?: readonly string[];
}

export interface ProviderMetadata {
  id: ProviderId;
  label: string;
  implemented: boolean;
  source: string;
  billingModel?: BillingModel;
  category?: ProviderCategory;
  envKeys?: readonly string[];
}

export const PROVIDER_METADATA: readonly ProviderMetadata[] = [
  {
    id: "codex",
    label: "OpenAI Codex",
    implemented: true,
    source: "codex-app-server",
    billingModel: "subscription",
    category: "coding_agent",
  },
  {
    id: "claude",
    label: "Claude Code",
    implemented: true,
    source: "claude-oauth-usage",
    billingModel: "subscription",
    category: "coding_agent",
  },
  {
    id: "antigravity",
    label: "Google Antigravity",
    implemented: true,
    source: "agy-cli-print",
    billingModel: "subscription",
    category: "coding_agent",
  },
  {
    id: "opencodego",
    label: "OpenCode Go",
    implemented: true,
    source: "opencode-zen-api",
    billingModel: "subscription",
    category: "coding_agent",
    envKeys: ["OPENCODE_API_KEY"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    implemented: true,
    source: "openrouter-api",
    billingModel: "hybrid",
    category: "aggregator",
    envKeys: ["OPEN_ROUTER_API_KEY", "OPENROUTER_API_KEY"],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    implemented: true,
    source: "deepseek-user-balance",
    billingModel: "balance",
    category: "llm_api",
    envKeys: ["DEEPSEEK_API_KEY"],
  },
  {
    id: "mimo",
    label: "Xiaomi MiMo",
    implemented: true,
    source: "xiaomi-token-plan",
    billingModel: "subscription",
    category: "llm_api",
    envKeys: ["MIMO_API_KEY"],
  },
  {
    id: "kimi",
    label: "Moonshot Kimi",
    implemented: true,
    source: "moonshot-balance",
    billingModel: "balance",
    category: "llm_api",
    envKeys: ["MOONSHOT_API_KEY", "KIMI_API_KEY"],
  },
  {
    id: "glm",
    label: "Zhipu GLM",
    implemented: true,
    source: "zhipu-open-balance",
    billingModel: "balance",
    category: "llm_api",
    envKeys: ["ZHIPU_API_KEY", "GLM_API_KEY"],
  },
  {
    id: "minimax",
    label: "MiniMax",
    implemented: true,
    source: "minimax-balance",
    billingModel: "balance",
    category: "llm_api",
    envKeys: ["MINIMAX_API_KEY"],
  },
  {
    id: "grok",
    label: "xAI Grok",
    implemented: true,
    source: "xai-api",
    billingModel: "balance",
    category: "llm_api",
    envKeys: ["XAI_API_KEY", "GROK_API_KEY"],
  },
];

const dynamicProviders: QuotaProvider[] = [];

export function registerProvider(provider: QuotaProvider): void {
  const existing = dynamicProviders.findIndex((p) => p.id === provider.id);
  if (existing >= 0) {
    dynamicProviders[existing] = provider;
  } else {
    dynamicProviders.push(provider);
  }
}

export function isProviderId(value: string): value is ProviderId {
  return (
    PROVIDER_METADATA.some((p) => p.id === value) || dynamicProviders.some((p) => p.id === value)
  );
}

export function builtInProviders(): QuotaProvider[] {
  return [
    { id: "codex", label: "OpenAI Codex", billingModel: "subscription", read: () => readCodex() },
    { id: "claude", label: "Claude Code", billingModel: "subscription", read: () => readClaude() },
    {
      id: "antigravity",
      label: "Google Antigravity",
      billingModel: "subscription",
      read: () => readAntigravity(),
    },
    {
      id: "opencodego",
      label: "OpenCode Go",
      billingModel: "subscription",
      read: opencodegoProvider.read,
    },
    {
      id: "openrouter",
      label: "OpenRouter",
      billingModel: "hybrid",
      read: openrouterProvider.read,
    },
    { id: "deepseek", label: "DeepSeek", billingModel: "balance", read: deepseekProvider.read },
    { id: "mimo", label: "Xiaomi MiMo", billingModel: "subscription", read: mimoProvider.read },
    { id: "kimi", label: "Moonshot Kimi", billingModel: "balance", read: kimiProvider.read },
    { id: "glm", label: "Zhipu GLM", billingModel: "balance", read: glmProvider.read },
    { id: "minimax", label: "MiniMax", billingModel: "balance", read: minimaxProvider.read },
    { id: "grok", label: "xAI Grok", billingModel: "balance", read: grokProvider.read },
    ...dynamicProviders,
  ];
}

/** One failed adapter never prevents other providers from reporting. */
export function readAll(
  ids: readonly ProviderId[],
  providers: readonly QuotaProvider[] = builtInProviders(),
): Effect.Effect<readonly QuotaSnapshot[]> {
  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  return Effect.all(
    ids.map((id) => {
      const provider = byId.get(id);
      if (!provider)
        return Effect.succeed(makeUnavailableSnapshot(id, "NOT_REGISTERED", "unsupported"));
      return provider
        .read()
        .pipe(
          Effect.catchAllCause(() =>
            Effect.succeed(makeUnavailableSnapshot(id, "PROVIDER_FAILED")),
          ),
        );
    }),
    { concurrency: 5 },
  );
}
