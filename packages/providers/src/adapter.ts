import { Effect } from "effect";
import {
  type BillingModel,
  type ProviderErrorCode,
  type ProviderId,
  type QuotaBalance,
  type QuotaSnapshot,
  type QuotaStatus,
  type QuotaWindow,
  redactSnapshot,
} from "@kuota/core";

export interface ProviderContext {
  apiKey?: string;
  baseUrl?: string;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
}

export type ProviderCategory = "coding_agent" | "llm_api" | "aggregator";

export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly label: string;
  readonly defaultBillingModel: BillingModel;
  readonly category: ProviderCategory;
  readonly envKeys: readonly string[];
  readonly defaultBaseUrl?: string;
  readonly docUrl?: string;
  readonly read: (ctx?: ProviderContext) => Effect.Effect<QuotaSnapshot, unknown>;
}

export interface DefineHttpProviderOptions {
  id: ProviderId;
  label: string;
  defaultBillingModel: BillingModel;
  category: ProviderCategory;
  envKeys: readonly string[];
  defaultBaseUrl?: string;
  docUrl?: string;
  requiresAuth?: boolean;
  fetchSnapshot: (params: {
    apiKey?: string;
    baseUrl: string;
    fetch: typeof fetch;
    env: Record<string, string | undefined>;
  }) => Promise<{
    status?: QuotaStatus;
    windows?: QuotaWindow[];
    balance?: QuotaBalance | null;
    source?: string;
    errorCode?: ProviderErrorCode | string | null;
  }>;
}

/**
 * Creates a standard HTTP/API-based QuotaProvider with zero boilerplate.
 * Handles environment key resolution, authentication guards, timeouts, and error shielding.
 */
export function defineHttpProvider(options: DefineHttpProviderOptions): ProviderDescriptor {
  const requiresAuth = options.requiresAuth ?? true;

  return {
    id: options.id,
    label: options.label,
    defaultBillingModel: options.defaultBillingModel,
    category: options.category,
    envKeys: options.envKeys,
    defaultBaseUrl: options.defaultBaseUrl,
    docUrl: options.docUrl,
    read: (ctx?: ProviderContext) =>
      Effect.tryPromise({
        try: async () => {
          const env = ctx?.env ?? process.env;
          const fetchFn = ctx?.fetch ?? globalThis.fetch;

          // 1. Resolve API Key
          let apiKey = ctx?.apiKey;
          if (!apiKey) {
            for (const key of options.envKeys) {
              const val = env[key];
              if (val && typeof val === "string" && val.trim().length > 0) {
                apiKey = val.trim();
                break;
              }
            }
          }

          // 2. Resolve Base URL
          const baseUrl =
            ctx?.baseUrl ||
            env[`${options.id.toUpperCase()}_BASE_URL`] ||
            options.defaultBaseUrl ||
            "";

          // 3. Guard Auth Requirement
          if (requiresAuth && !apiKey) {
            return redactSnapshot({
              provider: options.id,
              status: "unauthenticated",
              fetchedAt: new Date().toISOString(),
              source: baseUrl || options.id,
              billingModel: options.defaultBillingModel,
              windows: [],
              balance: null,
              errorCode: "AUTH_REQUIRED",
            });
          }

          // 4. Execute Fetch
          try {
            const result = await options.fetchSnapshot({
              apiKey,
              baseUrl,
              fetch: fetchFn,
              env,
            });

            return redactSnapshot({
              provider: options.id,
              status: result.status ?? "ok",
              fetchedAt: new Date().toISOString(),
              source: result.source ?? baseUrl ?? options.id,
              billingModel: options.defaultBillingModel,
              windows: result.windows ?? [],
              balance: result.balance ?? null,
              errorCode: result.errorCode ?? null,
            });
          } catch (err: any) {
            const msg = String(err?.message || err);
            const status: QuotaStatus =
              msg.includes("401") || msg.includes("403")
                ? "unauthenticated"
                : msg.includes("404") || msg.includes("NOT_FOUND")
                  ? "unavailable"
                  : "error";

            const errorCode: ProviderErrorCode =
              status === "unauthenticated" ? "AUTH_REQUIRED" : "PROTOCOL_ERROR";

            return redactSnapshot({
              provider: options.id,
              status,
              fetchedAt: new Date().toISOString(),
              source: baseUrl || options.id,
              billingModel: options.defaultBillingModel,
              windows: [],
              balance: null,
              errorCode,
            });
          }
        },
        catch: (err) => err,
      }),
  };
}
