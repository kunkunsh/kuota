import { defineHttpProvider } from "../adapter.js";
import { normalizeWindow, type QuotaWindow } from "@kuota/core";

export const openrouterProvider = defineHttpProvider({
  id: "openrouter",
  label: "OpenRouter",
  defaultBillingModel: "hybrid",
  category: "aggregator",
  envKeys: ["OPEN_ROUTER_API_KEY", "OPENROUTER_API_KEY"],
  defaultBaseUrl: "https://openrouter.ai/api/v1",
  docUrl: "https://openrouter.ai/docs",
  fetchSnapshot: async ({ apiKey, baseUrl, fetch }) => {
    const url = baseUrl.endsWith("/auth/key") ? baseUrl : `${baseUrl}/auth/key`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API error: HTTP ${res.status}`);
    }

    const json = (await res.json()) as any;
    const data = json?.data ?? {};

    const usageUSD = typeof data.usage === "number" ? data.usage : 0;
    const limitUSD = typeof data.limit === "number" ? data.limit : null;
    const remainingLimit = typeof data.limit_remaining === "number" ? data.limit_remaining : null;

    // Remaining balance is limit - usage (if limit set), or usage tracked against credit
    const totalBalance =
      remainingLimit != null
        ? remainingLimit
        : limitUSD != null
          ? Math.max(0, limitUSD - usageUSD)
          : usageUSD;

    const windows: QuotaWindow[] = [];
    if (data.free_model_daily_requests) {
      const free = data.free_model_daily_requests;
      const usedPct = free.limit > 0 ? (free.used / free.limit) * 100 : 0;
      windows.push(
        normalizeWindow({
          windowId: "free_tier_daily",
          usedPercent: usedPct,
          resetAt: data.limit_reset,
        }),
      );
    }

    return {
      status: "ok",
      source: "openrouter.ai-api",
      windows,
      balance: {
        balances: [
          {
            currency: "USD",
            totalBalance: Number(totalBalance.toFixed(2)),
          },
        ],
        usage: Number(usageUSD.toFixed(4)),
        limit: limitUSD,
      },
    };
  },
});

export const readOpenRouter = openrouterProvider.read;
