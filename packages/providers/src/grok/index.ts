import { defineHttpProvider } from "../adapter.js";

export const grokProvider = defineHttpProvider({
  id: "grok",
  label: "xAI Grok",
  defaultBillingModel: "balance",
  category: "llm_api",
  envKeys: ["XAI_API_KEY", "GROK_API_KEY"],
  defaultBaseUrl: "https://api.x.ai/v1",
  docUrl: "https://docs.x.ai",
  fetchSnapshot: async ({ apiKey, baseUrl, fetch }) => {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api-key`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.ok) {
      const json = (await res.json()) as any;
      return {
        status: "ok",
        source: "api.x.ai",
        balance: {
          balances: [
            {
              currency: "USD",
              totalBalance: typeof json?.balance === "number" ? json.balance : 0,
            },
          ],
        },
        windows: [],
      };
    }

    // Fallback: check models endpoint
    const modelRes = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!modelRes.ok) {
      throw new Error(`xAI Grok error: HTTP ${modelRes.status}`);
    }

    return {
      status: "ok",
      source: "api.x.ai",
      balance: {
        balances: [{ currency: "USD", totalBalance: 0 }],
      },
      windows: [],
    };
  },
});

export const readGrok = grokProvider.read;
