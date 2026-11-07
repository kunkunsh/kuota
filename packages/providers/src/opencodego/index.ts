import { defineHttpProvider } from "../adapter.js";
import { normalizeWindow, type QuotaWindow } from "@kuota/core";

export const opencodegoProvider = defineHttpProvider({
  id: "opencodego",
  label: "OpenCode Go",
  defaultBillingModel: "subscription",
  category: "coding_agent",
  envKeys: ["OPENCODE_API_KEY"],
  defaultBaseUrl: "https://opencode.ai/zen/go/v1",
  docUrl: "https://opencode.ai",
  fetchSnapshot: async ({ apiKey, baseUrl, fetch }) => {
    const url = baseUrl.endsWith("/usage") ? baseUrl : `${baseUrl}/usage`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`OpenCode API error: HTTP ${res.status}`);
    }

    const data = (await res.json()) as any;
    const usage = data?.usage ?? {};
    const windows: QuotaWindow[] = [];

    if (usage.rolling) {
      windows.push(
        normalizeWindow({
          windowId: "session.rolling",
          usedPercent: typeof usage.rolling.percent === "number" ? usage.rolling.percent : null,
          resetAt: usage.rolling.resetsAt,
        }),
      );
    }

    if (usage.weekly) {
      windows.push(
        normalizeWindow({
          windowId: "weekly",
          usedPercent: typeof usage.weekly.percent === "number" ? usage.weekly.percent : null,
          resetAt: usage.weekly.resetsAt,
        }),
      );
    }

    if (usage.monthly) {
      windows.push(
        normalizeWindow({
          windowId: "monthly",
          usedPercent: typeof usage.monthly.percent === "number" ? usage.monthly.percent : null,
          resetAt: usage.monthly.resetsAt,
        }),
      );
    }

    return {
      status: "ok",
      source: "opencode.ai-api",
      windows,
    };
  },
});

export const readOpenCodeGo = opencodegoProvider.read;
