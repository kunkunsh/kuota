import { defineHttpProvider } from "../adapter.js";
import type { QuotaBalanceItem } from "@kuota/core";

export const openaiProvider = defineHttpProvider({
  id: "openai",
  label: "OpenAI Platform",
  defaultBillingModel: "balance",
  category: "llm_api",
  envKeys: ["OPENAI_API_KEY"],
  defaultBaseUrl: "https://api.openai.com/v1",
  docUrl: "https://platform.openai.com/docs",
  fetchSnapshot: async ({ apiKey, baseUrl, fetch }) => {
    // 1. Verify API Key validity against OpenAI v1 API
    const modelsUrl = `${baseUrl.replace(/\/$/, "")}/models`;
    const res = await fetch(modelsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return {
          status: "unauthenticated",
          errorCode: "INVALID_KEY",
          source: "api.openai.com",
          windows: [],
        };
      }
      throw new Error(`OpenAI API error: HTTP ${res.status}`);
    }

    const data = (await res.json()) as any;
    const modelList = Array.isArray(data?.data) ? data.data : [];

    // 2. Attempt reading usage if key has organization scopes
    let usageAmount: number | undefined;
    try {
      const now = new Date();
      const startTime = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
      const usageRes = await fetch(
        `https://api.openai.com/v1/organization/costs?start_time=${startTime}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        },
      );
      if (usageRes.ok) {
        const usageData = (await usageRes.json()) as any;
        if (Array.isArray(usageData?.data) && usageData.data[0]?.results?.[0]?.amount?.value) {
          usageAmount = usageData.data[0].results[0].amount.value;
        }
      }
    } catch {
      // restricted or project-scoped key
    }

    const balances: QuotaBalanceItem[] = [
      {
        currency: "USD",
        totalBalance: 0,
        usage: usageAmount ?? 0,
      },
    ];

    return {
      status: "ok",
      source: "api.openai.com",
      balance: {
        balances,
      },
      windows: [],
    };
  },
});

export const readOpenAI = openaiProvider.read;
