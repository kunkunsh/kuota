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
    // 1. Probe Xiaomi Token-Plan cluster models
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

    // 2. Check if Token Plan quota is exhausted (429 limitation)
    let isExhausted = false;
    try {
      const probeRes = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelList[0]?.id || "mimo-v2.5-asr",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
      });

      if (probeRes.status === 429) {
        const errJson = (await probeRes.json().catch(() => ({}))) as any;
        if (
          errJson?.error?.message?.includes("quota exhausted") ||
          errJson?.error?.code === "429" ||
          errJson?.error?.type === "limitation"
        ) {
          isExhausted = true;
        }
      }
    } catch {
      // ignore
    }

    // Token Plan subscription window: 100% used (0% remaining) if exhausted
    const windows: QuotaWindow[] = [
      normalizeWindow({
        windowId: "monthly.token_plan",
        usedPercent: isExhausted ? 100 : 0,
        resetAt: null,
      }),
    ];

    return {
      status: "ok",
      source: "token-plan-cn.xiaomimimo.com",
      windows,
      balance: null, // Xiaomi Token Plan is pure subscription quota, no RMB credit balance
    };
  },
});

export const readMimo = mimoProvider.read;
