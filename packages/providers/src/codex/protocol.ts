import { normalizeWindow, type QuotaSnapshot, type QuotaWindow } from "@kuota/core";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Parses only the non-sensitive subset of the Codex app-server v2 quota response. */
export function parseCodexRateLimits(raw: unknown, fetchedAt = new Date()): QuotaSnapshot {
  const response = asRecord(raw);
  const limits = asRecord(response?.rateLimits);
  const common = {
    provider: "codex" as const,
    source: "codex-app-server",
    fetchedAt: fetchedAt.toISOString(),
  };

  if (!limits) {
    return { ...common, status: "unavailable", windows: [], errorCode: "NO_RATE_LIMITS" };
  }

  let malformed = false;
  const windows: QuotaWindow[] = [];
  for (const windowId of ["primary", "secondary"] as const) {
    const window = asRecord(limits[windowId]);
    if (!window) continue;
    const usedPercent = window.usedPercent;
    if (
      typeof usedPercent !== "number" ||
      !Number.isFinite(usedPercent) ||
      usedPercent < 0 ||
      usedPercent > 100
    ) {
      malformed = true;
    }
    const reset = window.resetsAt;
    const resetAt =
      typeof reset === "number" && Number.isFinite(reset) && reset >= 0
        ? new Date(reset * 1000).toISOString()
        : null;
    windows.push(normalizeWindow({ windowId, usedPercent, resetAt }));
  }

  const blocked = response?.ordinaryUsageAllowed === false;
  return {
    ...common,
    status: windows.length === 0 ? "unavailable" : malformed || blocked ? "partial" : "ok",
    windows,
    errorCode:
      windows.length === 0
        ? "NO_WINDOWS"
        : blocked
          ? "ORDINARY_USAGE_BLOCKED"
          : malformed
            ? "INVALID_WINDOW"
            : null,
  };
}
