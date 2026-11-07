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

  const rawCredits = asRecord(limits.credits);
  let credits: QuotaSnapshot["credits"] = null;
  if (rawCredits && rawCredits.hasCredits) {
    const bal =
      typeof rawCredits.balance === "number"
        ? rawCredits.balance
        : typeof rawCredits.balance === "string"
          ? parseFloat(rawCredits.balance)
          : 0;
    credits = {
      hasCredits: true,
      balance: Number.isFinite(bal) ? bal : 0,
      unlimited: Boolean(rawCredits.unlimited),
    };
  }

  const rawResetCredits = asRecord(response?.rateLimitResetCredits);
  let resetCredits: QuotaSnapshot["resetCredits"] = null;
  if (rawResetCredits && typeof rawResetCredits.availableCount === "number") {
    let nextResetAt: string | null = null;
    if (Array.isArray(rawResetCredits.credits) && rawResetCredits.credits.length > 0) {
      const first = asRecord(rawResetCredits.credits[0]);
      if (typeof first?.resetsAt === "number" && Number.isFinite(first.resetsAt)) {
        nextResetAt = new Date(first.resetsAt * 1000).toISOString();
      }
    }
    resetCredits = {
      availableCount: rawResetCredits.availableCount,
      resetsAt: nextResetAt,
    };
  }

  const planType = typeof limits.planType === "string" ? limits.planType : null;

  return {
    ...common,
    billingModel: "subscription",
    status: windows.length === 0 ? "unavailable" : malformed || blocked ? "partial" : "ok",
    windows,
    planType,
    credits,
    resetCredits,
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
