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
  consoleUrl?: string;
  howToGet?: string;
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
    consoleUrl: "https://platform.openai.com/api-keys",
    howToGet: "本地运行 codex 会话，或在 OpenAI 控制台创建 API Key",
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
    consoleUrl: "https://console.anthropic.com/",
    howToGet: "本地运行 claude 命令行登录，或在 Anthropic 控制台获取 Key",
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
    consoleUrl: "https://aistudio.google.com/",
    howToGet: "本地 agy CLI 会话，或在 Google AI Studio 获取 API Key",
    description: "Google Antigravity and Gemini CLI quota telemetry.",
  },
  {
    id: "opencodego",
    name: "OpenCode Go",
    shortName: "OpenCode Go",
    category: "coding_agent",
    billingModel: "subscription",
    source: "opencode-go-api",
    defaultPlan: "Go Plan",
    envKeys: ["OPENCODE_API_KEY"],
    defaultEndpoint: "https://opencode.ai/zen/go/v1/usage",
    docUrl: "https://opencode.ai",
    consoleUrl: "https://opencode.ai",
    howToGet: "访问 OpenCode 控制台 -> Account -> API Key 复制填入",
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
    consoleUrl: "https://openrouter.ai/keys",
    howToGet: "访问 OpenRouter.ai -> Keys -> 点击 Create Key 复制填入",
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
    consoleUrl: "https://platform.deepseek.com/api_keys",
    howToGet: "访问 DeepSeek 开放平台 -> 左侧 API Keys -> 创建并复制填入",
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
    consoleUrl: "https://platform.xiaomimimo.com",
    howToGet: "访问 小米 MiMo 平台 -> Token Plan / API 管理页面获取",
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
    consoleUrl: "https://platform.moonshot.cn/console/api-keys",
    howToGet: "访问 Moonshot 开放平台 -> API Keys -> 新建 API Key 并复制填入",
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
    consoleUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    howToGet: "访问 智谱开放平台 (bigmodel.cn) -> 用户中心 -> API Keys",
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
    consoleUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    howToGet: "访问 MiniMax 开放平台 -> 账户管理 -> 接口密钥复制填入",
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
    consoleUrl: "https://console.x.ai/",
    howToGet: "访问 xAI 控制台 (console.x.ai) -> API Keys -> Create Key",
    description: "xAI Grok API key balance, monthly limits, and model probes.",
  },
  {
    id: "openai",
    name: "OpenAI Platform",
    shortName: "OpenAI",
    category: "llm_api",
    billingModel: "balance",
    source: "openai-api-platform",
    defaultPlan: "API Platform",
    envKeys: ["OPENAI_API_KEY"],
    defaultEndpoint: "https://api.openai.com/v1",
    docUrl: "https://platform.openai.com/docs",
    consoleUrl: "https://platform.openai.com/usage",
    howToGet:
      "访问 OpenAI Platform -> Dashboard -> API Keys 创建 Key，并在 Usage 页面查看额度与充值",
    description: "OpenAI Developer Platform API credit balance, usage limits, and project grants.",
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
