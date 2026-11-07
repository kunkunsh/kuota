import { defineHttpProvider } from "../adapter.js";
import { normalizeWindow, type QuotaWindow } from "@kuota/core";

export const mimoProvider = defineHttpProvider({
  id: "mimo",
  label: "Xiaomi MiMo",
  defaultBillingModel: "subscription",
  category: "llm_api",
  envKeys: ["MIMO_API_KEY"],
  defaultBaseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
  docUrl: "https://platform.xiaomimimo.com",
  fetchSnapshot: async ({ apiKey, baseUrl, fetch }) => {
    // Probe Xiaomi Token-Plan cluster
    const modelsUrl = `${baseUrl.replace(/\/$/, "")}/models`;
    const res = await fetch(modelsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Xiaomi MiMo error: HTTP ${res.status}`);
    }

    const data = (await res.json()) as any;
    const modelList = Array.isArray(data?.data) ? data.data : [];

    // Model windows active in this token plan
    const windows: QuotaWindow[] = [
      normalizeWindow({
        windowId: "token_plan.active",
        usedPercent: 0,
        resetAt: null,
      }),
    ];

    return {
      status: modelList.length > 0 ? "ok" : "partial",
      source: "xiaomimimo.com",
      windows,
      balance: {
        balances: [
          {
            currency: "CNY",
            totalBalance: modelList.length, // Active models in token plan
          },
        ],
      },
    };
  },
});

export const readMimo = mimoProvider.read;
