import { defineHttpProvider } from "../adapter.js";
import type { QuotaBalanceItem } from "@kuota/core";

export const deepseekProvider = defineHttpProvider({
  id: "deepseek",
  label: "DeepSeek",
  defaultBillingModel: "balance",
  category: "llm_api",
  envKeys: ["DEEPSEEK_API_KEY"],
  defaultBaseUrl: "https://api.deepseek.com",
  docUrl: "https://platform.deepseek.com/api-docs",
  fetchSnapshot: async ({ apiKey, baseUrl, fetch }) => {
    const url = baseUrl.endsWith("/user/balance") ? baseUrl : `${baseUrl}/user/balance`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`DeepSeek API error: HTTP ${res.status}`);
    }

    const data = (await res.json()) as any;
    const isAvailable = Boolean(data?.is_available);
    const balanceInfos = Array.isArray(data?.balance_infos) ? data.balance_infos : [];

    // DeepSeek returns both USD and CNY balances.
    // Parse all currencies and prioritize positive funded balance over empty/negative debt.
    const balances: QuotaBalanceItem[] = balanceInfos
      .map((b: any) => ({
        currency: String(b.currency || "USD"),
        totalBalance: parseFloat(b.total_balance) || 0,
        grantedBalance: b.granted_balance != null ? parseFloat(b.granted_balance) : undefined,
        toppedUpBalance: b.topped_up_balance != null ? parseFloat(b.topped_up_balance) : undefined,
      }))
      .sort((a: QuotaBalanceItem, b: QuotaBalanceItem) => {
        if (a.totalBalance > 0 && b.totalBalance <= 0) return -1;
        if (b.totalBalance > 0 && a.totalBalance <= 0) return 1;
        return 0;
      });

    return {
      status: isAvailable ? "ok" : "unavailable",
      source: "api.deepseek.com",
      balance: {
        balances,
      },
      windows: [],
    };
  },
});

export const readDeepSeek = deepseekProvider.read;
