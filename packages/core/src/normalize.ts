import type { ProviderId, QuotaSnapshot, QuotaStatus, QuotaWindow } from "./types.js";

export interface WindowInput {
  windowId: string;
  usedPercent?: unknown;
  resetAt?: unknown;
}

function safePercent(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

function safeIsoDate(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function normalizeWindow(input: WindowInput): QuotaWindow {
  const usedPercent = safePercent(input.usedPercent);
  return {
    windowId: input.windowId,
    usedPercent,
    remainingPercent: usedPercent === null ? null : Number((100 - usedPercent).toFixed(2)),
    resetAt: safeIsoDate(input.resetAt),
  };
}

/** Whitelist public response fields: never forward token-like keys or provider raw payloads. */
export function redactSnapshot(input: Record<string, unknown>): QuotaSnapshot {
  const provider = input.provider;
  const status = input.status;
  const billingModel =
    input.billingModel === "subscription" ||
    input.billingModel === "balance" ||
    input.billingModel === "hybrid"
      ? input.billingModel
      : undefined;

  let balance = null;
  if (input.balance && typeof input.balance === "object") {
    const rawBal = input.balance as Record<string, unknown>;
    if (Array.isArray(rawBal.balances)) {
      balance = {
        balances: rawBal.balances
          .filter((b) => b && typeof b === "object")
          .map((b: any) => ({
            currency: String(b.currency || "USD"),
            totalBalance: Number(b.totalBalance) || 0,
            grantedBalance: b.grantedBalance != null ? Number(b.grantedBalance) : undefined,
            toppedUpBalance: b.toppedUpBalance != null ? Number(b.toppedUpBalance) : undefined,
          })),
        usage: rawBal.usage != null ? Number(rawBal.usage) : undefined,
        limit: rawBal.limit != null ? Number(rawBal.limit) : undefined,
        burnRateDaily: rawBal.burnRateDaily != null ? Number(rawBal.burnRateDaily) : undefined,
        estimatedDaysLeft:
          rawBal.estimatedDaysLeft != null ? Number(rawBal.estimatedDaysLeft) : undefined,
      };
    }
  }

  const result: QuotaSnapshot = {
    provider: typeof provider === "string" ? provider : "unknown",
    status:
      status === "ok" ||
      status === "partial" ||
      status === "unauthenticated" ||
      status === "unavailable" ||
      status === "unsupported" ||
      status === "error"
        ? (status as QuotaStatus)
        : "error",
    fetchedAt: safeIsoDate(input.fetchedAt) ?? new Date(0).toISOString(),
    source: typeof input.source === "string" ? input.source : "unknown",
    windows: Array.isArray(input.windows)
      ? input.windows.flatMap((window): QuotaWindow[] => {
          if (!window || typeof window !== "object") return [];
          const value = window as Record<string, unknown>;
          if (typeof value.windowId !== "string") return [];
          return [
            normalizeWindow({
              windowId: value.windowId,
              usedPercent: value.usedPercent,
              resetAt: value.resetAt,
            }),
          ];
        })
      : [],
    errorCode: typeof input.errorCode === "string" ? input.errorCode : null,
    ...(billingModel !== undefined ? { billingModel } : {}),
    ...(balance !== null ? { balance } : {}),
  };
  return result;
}

export function makeUnavailableSnapshot(
  provider: ProviderId,
  errorCode: string,
  status: QuotaStatus = "unavailable",
): QuotaSnapshot {
  return {
    provider,
    status,
    fetchedAt: new Date().toISOString(),
    source: "local-probe",
    windows: [],
    errorCode,
  };
}
