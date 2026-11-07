import type { BillingModel, QuotaSnapshot } from "./types.js";

export type ProviderCategory = "coding_agent" | "llm_api" | "aggregator" | "custom";

export interface ProviderCatalogEntry {
  id: string;
  name: string;
  shortName: string;
  category: ProviderCategory;
  billingModel: BillingModel;
  source: string;
  defaultPlan: string;
  envKeys: readonly string[];
  defaultEndpoint?: string;
  docUrl?: string;
  description: string;
}

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    id: "codex",
    name: "OpenAI Codex",
    shortName: "Codex",
    category: "coding_agent",
    billingModel: "subscription",
    source: "codex-app-server",
    defaultPlan: "Pro",
    envKeys: ["OPENAI_API_KEY"],
    docUrl: "https://platform.openai.com",
    description: "OpenAI Codex subscription rate limits via local app-server JSON-RPC.",
  },
  {
    id: "claude",
    name: "Claude Code",
    shortName: "Claude",
    category: "coding_agent",
    billingModel: "subscription",
    source: "claude-oauth-usage",
    defaultPlan: "Max 20x",
    envKeys: ["ANTHROPIC_API_KEY", "CLAUDE_CODE_TOKEN"],
    docUrl: "https://anthropic.com",
    description: "Anthropic Claude Code weekly and 5-hour rolling session quotas.",
  },
  {
    id: "antigravity",
    name: "Google Antigravity",
    shortName: "Antigravity",
    category: "coding_agent",
    billingModel: "subscription",
    source: "agy-cli-probe",
    defaultPlan: "Gemini",
    envKeys: ["GEMINI_API_KEY"],
    docUrl: "https://ai.google.dev",
    description: "Google Antigravity and Gemini CLI quota telemetry.",
  },
  {
    id: "opencodego",
    name: "OpenCode Go",
    shortName: "OpenCode Go",
    category: "coding_agent",
    billingModel: "subscription",
    source: "opencode-zen-api",
    defaultPlan: "Zen Plan",
    envKeys: ["OPENCODE_API_KEY"],
    defaultEndpoint: "https://opencode.ai/zen/go/v1/usage",
    docUrl: "https://opencode.ai",
    description: "OpenCode Go rolling, weekly, and monthly subscription limits.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    shortName: "OpenRouter",
    category: "aggregator",
    billingModel: "hybrid",
    source: "openrouter-api",
    defaultPlan: "Prepaid Credit",
    envKeys: ["OPEN_ROUTER_API_KEY", "OPENROUTER_API_KEY"],
    defaultEndpoint: "https://openrouter.ai/api/v1/auth/key",
    docUrl: "https://openrouter.ai/docs",
    description: "OpenRouter unified prepaid credit balance, usage limits, and daily caps.",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DeepSeek",
    category: "llm_api",
    billingModel: "balance",
    source: "deepseek-user-balance",
    defaultPlan: "Prepaid Wallet",
    envKeys: ["DEEPSEEK_API_KEY"],
    defaultEndpoint: "https://api.deepseek.com/user/balance",
    docUrl: "https://platform.deepseek.com",
    description: "DeepSeek USD & CNY cash balance and granted credits.",
  },
  {
    id: "mimo",
    name: "Xiaomi MiMo",
    shortName: "MiMo",
    category: "llm_api",
    billingModel: "hybrid",
    source: "xiaomi-token-plan",
    defaultPlan: "Token Plan",
    envKeys: ["MIMO_API_KEY"],
    defaultEndpoint: "https://token-plan-cn.xiaomimimo.com/v1",
    docUrl: "https://platform.xiaomimimo.com",
    description: "Xiaomi MiMo token quotas, monthly plan limits, and credit balances.",
  },
  {
    id: "kimi",
    name: "Moonshot Kimi",
    shortName: "Kimi",
    category: "llm_api",
    billingModel: "balance",
    source: "moonshot-balance",
    defaultPlan: "Prepaid Balance",
    envKeys: ["MOONSHOT_API_KEY", "KIMI_API_KEY"],
    defaultEndpoint: "https://api.moonshot.cn/v1/users/me/balance",
    docUrl: "https://platform.moonshot.cn",
    description: "Moonshot AI Kimi user balance and cash credits.",
  },
  {
    id: "glm",
    name: "Zhipu GLM",
    shortName: "GLM",
    category: "llm_api",
    billingModel: "balance",
    source: "zhipu-open-balance",
    defaultPlan: "Prepaid Credit",
    envKeys: ["ZHIPU_API_KEY", "GLM_API_KEY", "BIGMODEL_API_KEY", "Z_AI_API_KEY"],
    defaultEndpoint: "https://open.bigmodel.cn/api/paas/v4",
    docUrl: "https://open.bigmodel.cn",
    description: "Zhipu AI GLM / BigModel credit reports and coding plan usage.",
  },
  {
    id: "minimax",
    name: "MiniMax",
    shortName: "MiniMax",
    category: "llm_api",
    billingModel: "balance",
    source: "minimax-balance",
    defaultPlan: "Prepaid Wallet",
    envKeys: ["MINIMAX_API_KEY"],
    defaultEndpoint: "https://api.minimax.chat/v1",
    docUrl: "https://www.minimaxi.com",
    description: "MiniMax API cash balance and granted token credits.",
  },
  {
    id: "grok",
    name: "xAI Grok",
    shortName: "Grok",
    category: "llm_api",
    billingModel: "balance",
    source: "xai-api",
    defaultPlan: "Prepaid Credit",
    envKeys: ["XAI_API_KEY", "GROK_API_KEY"],
    defaultEndpoint: "https://api.x.ai/v1/api-key",
    docUrl: "https://x.ai",
    description: "xAI Grok API key balance, monthly limits, and model probes.",
  },
];

export function getProviderMeta(id: string): ProviderCatalogEntry {
  const norm = id.toLowerCase();
  const found = PROVIDER_CATALOG.find((p) => p.id === norm || norm.includes(p.id));
  if (found) return found;
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    shortName: id,
    category: "custom",
    billingModel: "balance",
    source: "custom-api",
    defaultPlan: "Custom",
    envKeys: [`${id.toUpperCase()}_API_KEY`],
    description: `Custom configured provider ${id}`,
  };
}

export function formatCurrencyAmount(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  const sym = currency === "CNY" ? "¥" : currency === "EUR" ? "€" : "$";
  return `${sym}${amount.toFixed(2)}`;
}

export function isBalanceFirst(snapshot: QuotaSnapshot): boolean {
  if (snapshot.billingModel === "balance") return true;
  if (snapshot.balance && snapshot.balance.balances.length > 0 && snapshot.windows.length === 0)
    return true;
  return false;
}
