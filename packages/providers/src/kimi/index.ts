import { defineHttpProvider } from "../adapter.js";

export const kimiProvider = defineHttpProvider({
  id: "kimi",
  label: "Moonshot Kimi",
  defaultBillingModel: "balance",
  category: "llm_api",
  envKeys: ["MOONSHOT_API_KEY", "KIMI_API_KEY"],
  defaultBaseUrl: "https://api.moonshot.cn/v1",
  docUrl: "https://platform.moonshot.cn/docs",
  fetchSnapshot: async ({ apiKey, baseUrl, fetch }) => {
    const url = `${baseUrl.replace(/\/$/, "")}/users/me/balance`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Moonshot Kimi API error: HTTP ${res.status}`);
    }

    const json = (await res.json()) as any;
    const data = json?.data ?? {};

    const available = parseFloat(data.available_balance) || 0;
    const voucher = parseFloat(data.voucher_balance) || 0;
    const cash = parseFloat(data.cash_balance) || 0;

    return {
      status: "ok",
      source: "api.moonshot.cn",
      balance: {
        balances: [
          {
            currency: "CNY",
            totalBalance: available,
            grantedBalance: voucher,
            toppedUpBalance: cash,
          },
        ],
      },
      windows: [],
    };
  },
});

export const readKimi = kimiProvider.read;
