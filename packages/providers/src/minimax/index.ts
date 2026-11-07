import { defineHttpProvider } from "../adapter.js";

export const minimaxProvider = defineHttpProvider({
  id: "minimax",
  label: "MiniMax",
  defaultBillingModel: "balance",
  category: "llm_api",
  envKeys: ["MINIMAX_API_KEY"],
  defaultBaseUrl: "https://api.minimax.chat/v1",
  docUrl: "https://www.minimaxi.com",
  fetchSnapshot: async ({ apiKey, baseUrl, fetch }) => {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`MiniMax API error: HTTP ${res.status}`);
    }

    return {
      status: "ok",
      source: "api.minimax.chat",
      balance: {
        balances: [{ currency: "CNY", totalBalance: 0 }],
      },
      windows: [],
    };
  },
});

export const readMiniMax = minimaxProvider.read;
