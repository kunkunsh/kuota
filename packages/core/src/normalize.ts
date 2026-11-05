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
  return {
    provider: provider === "claude" || provider === "antigravity" ? provider : "codex",
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
  };
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
