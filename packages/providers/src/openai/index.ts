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
    // 1. Verify API Key and retrieve user profile / organization
    const meRes = await fetch(`${baseUrl.replace(/\/$/, "")}/me`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    let userName: string | undefined;
    let userEmail: string | undefined;
    let orgTitle = "Personal";
    let orgId: string | undefined;

    if (meRes.ok) {
      const meData = (await meRes.json().catch(() => ({}))) as any;
      userName = meData?.name;
      userEmail = meData?.email;
      const defaultOrg = meData?.orgs?.data?.[0];
      if (defaultOrg) {
        orgTitle = defaultOrg.title || defaultOrg.name || "Personal";
        orgId = defaultOrg.id;
      }
    } else if (meRes.status === 401) {
      return {
        status: "unauthenticated",
        errorCode: "INVALID_KEY",
        source: "api.openai.com",
        windows: [],
      };
    }

    // 2. Check if key has organization costs/usage reading scopes
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    };
    if (orgId) {
      headers["OpenAI-Organization"] = orgId;
    }

    let hasUsageScope = false;
    let currentSpend: number | undefined;

    try {
      const now = new Date();
      const startTime = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
      const usageRes = await fetch(
        `https://api.openai.com/v1/organization/costs?start_time=${startTime}`,
        { headers },
      );

      if (usageRes.ok) {
        hasUsageScope = true;
        const usageData = (await usageRes.json().catch(() => ({}))) as any;
        if (Array.isArray(usageData?.data) && usageData.data[0]?.results?.[0]?.amount?.value) {
          currentSpend = usageData.data[0].results[0].amount.value;
        }
      } else if (usageRes.status === 403) {
        hasUsageScope = false;
      }
    } catch {
      hasUsageScope = false;
    }

    // If key has usage read scope, return the balances.
    // Otherwise, report honest active state without faking a $0.00 credit balance!
    const balances: QuotaBalanceItem[] = hasUsageScope
      ? [
          {
            currency: "USD",
            totalBalance: 0,
            usage: currentSpend,
          },
        ]
      : [];

    return {
      status: "ok",
      source: "api.openai.com",
      balance: balances.length > 0 ? { balances } : null,
      windows: [],
      errorCode: hasUsageScope ? null : "SCOPE_USAGE_READ_REQUIRED",
    };
  },
});

export const readOpenAI = openaiProvider.read;
