import { defineHttpProvider } from "../adapter.js";

export const glmProvider = defineHttpProvider({
  id: "glm",
  label: "Zhipu GLM",
  defaultBillingModel: "balance",
  category: "llm_api",
  envKeys: ["ZHIPU_API_KEY", "GLM_API_KEY"],
  defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
  docUrl: "https://open.bigmodel.cn/dev/api",
  fetchSnapshot: async ({ apiKey, baseUrl, fetch }) => {
    const url = `${baseUrl.replace(/\/$/, "")}/users/me/balance`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      if (res.ok) {
        const json = (await res.json()) as any;
        const total = parseFloat(json?.total_balance ?? json?.balance ?? 0);
        return {
          status: "ok",
          source: "open.bigmodel.cn",
          balance: {
            balances: [{ currency: "CNY", totalBalance: total }],
          },
          windows: [],
        };
      }
    } catch {
      // Fallback: validate key against models endpoint
    }

    const testRes = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!testRes.ok) {
      throw new Error(`Zhipu GLM API error: HTTP ${testRes.status}`);
    }

    return {
      status: "ok",
      source: "open.bigmodel.cn",
      balance: {
        balances: [{ currency: "CNY", totalBalance: 0 }],
      },
      windows: [],
    };
  },
});

export const readGLM = glmProvider.read;
