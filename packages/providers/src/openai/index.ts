import { defineHttpProvider } from "../adapter.js";
import type { QuotaBalanceItem, QuotaWindow } from "@kuota/core";

export const openaiProvider = defineHttpProvider({
  id: "openai",
  label: "OpenAI Platform",
  defaultBillingModel: "balance",
  category: "llm_api",
  envKeys: ["OPENAI_ADMIN_API_KEY", "OPENAI_API_KEY"],
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

    // 2. Query Organization Costs (Spend for the current month)
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    };
    if (orgId) {
      headers["OpenAI-Organization"] = orgId;
    }

    let hasAdminScope = false;
    let monthSpend = 0;
    let tokens7d = 0;
    let requests7d = 0;

    try {
      const now = new Date();
      const monthStart = Math.floor(
        new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000,
      );
      const costsRes = await fetch(
        `https://api.openai.com/v1/organization/costs?start_time=${monthStart}&limit=31`,
        { headers },
      );

      if (costsRes.ok) {
        hasAdminScope = true;
        const costsData = (await costsRes.json().catch(() => ({}))) as any;
        if (Array.isArray(costsData?.data)) {
          for (const bucket of costsData.data) {
            for (const r of bucket.results || []) {
              if (typeof r.amount?.value === "number") {
                monthSpend += r.amount.value;
              }
            }
          }
        }
      } else if (costsRes.status === 403) {
        hasAdminScope = false;
      }
    } catch {
      hasAdminScope = false;
    }

    // 3. Query 7-day usage completions for activity metrics
    if (hasAdminScope) {
      try {
        const nowSec = Math.floor(Date.now() / 1000);
        const start7d = nowSec - 7 * 86400;
        const usageRes = await fetch(
          `https://api.openai.com/v1/organization/usage/completions?start_time=${start7d}&bucket_width=1d`,
          { headers },
        );
        if (usageRes.ok) {
          const usageJson = (await usageRes.json().catch(() => ({}))) as any;
          if (Array.isArray(usageJson?.data)) {
            for (const bucket of usageJson.data) {
              for (const r of bucket.results || []) {
                tokens7d += (r.input_tokens || 0) + (r.output_tokens || 0);
                requests7d += r.num_model_requests || 0;
              }
            }
          }
        }
      } catch {
        // optional metric
      }
    }

    const balances: QuotaBalanceItem[] = hasAdminScope
      ? [
          {
            currency: "USD",
            totalBalance: 0,
            usage: monthSpend,
            grantedBalance: 0,
            toppedUpBalance: 0,
          },
        ]
      : [];

    const windows: QuotaWindow[] = [];
    if (hasAdminScope && tokens7d > 0) {
      windows.push({
        windowId: "completions.7d",
        usedPercent: 0,
        remainingPercent: 100,
        resetAt: new Date(Date.now() + 86400000).toISOString(),
      });
    }

    return {
      status: "ok",
      source: "api.openai.com",
      balance: balances.length > 0 ? { balances } : null,
      windows,
      errorCode: hasAdminScope ? null : "SCOPE_USAGE_READ_REQUIRED",
    };
  },
});

export const readOpenAI = openaiProvider.read;
