import { Effect } from "effect";
import {
  type BillingModel,
  type QuotaBalance,
  type QuotaWindow,
  redactSnapshot,
} from "@kuota/core";

export interface CustomProviderConfig {
  id: string;
  label: string;
  baseUrl: string;
  apiKey?: string;
  billingModel: BillingModel;
  currency?: string;
  headers?: Record<string, string>;
}

export function createCustomProvider(config: CustomProviderConfig) {
  return {
    id: config.id,
    label: config.label,
    defaultBillingModel: config.billingModel,
    category: "llm_api" as const,
    envKeys: [] as const,
    defaultBaseUrl: config.baseUrl,
    read: () =>
      Effect.tryPromise({
        try: async () => {
          const headers: Record<string, string> = {
            Accept: "application/json",
            ...config.headers,
          };
          if (config.apiKey) {
            headers.Authorization = `Bearer ${config.apiKey}`;
          }

          const res = await fetch(config.baseUrl, { headers });
          if (!res.ok) {
            return redactSnapshot({
              provider: config.id,
              status: res.status === 401 || res.status === 403 ? "unauthenticated" : "error",
              fetchedAt: new Date().toISOString(),
              source: config.baseUrl,
              billingModel: config.billingModel,
              windows: [],
              balance: null,
              errorCode: res.status === 401 ? "AUTH_REQUIRED" : "PROTOCOL_ERROR",
            });
          }

          const data = (await res.json()) as any;
          const windows: QuotaWindow[] = [];
          let balance: QuotaBalance | null = null;

          if (config.billingModel === "balance") {
            const num = parseFloat(data?.balance ?? data?.total_balance ?? data?.total ?? 0);
            balance = {
              balances: [
                {
                  currency: config.currency || "USD",
                  totalBalance: num,
                },
              ],
            };
          }

          return redactSnapshot({
            provider: config.id,
            status: "ok",
            fetchedAt: new Date().toISOString(),
            source: config.baseUrl,
            billingModel: config.billingModel,
            windows,
            balance,
            errorCode: null,
          });
        },
        catch: (err) => err,
      }),
  };
}
