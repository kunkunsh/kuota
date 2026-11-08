import type { QuotaSnapshot } from "./types.js";
import { getProviderMeta } from "./catalog.js";

export type MenuBarDisplayMode =
  | "icon_only"
  | "frontmost_app"
  | "primary_percent"
  | "lowest_quota"
  | "wallet_spend"
  | "provider_label";

export interface QuotaAlertEvent {
  type: "low_quota" | "quota_reset";
  provider: string;
  windowId: string;
  remainingPercent: number;
  resetAt?: string | null;
}

export function computeTrayTitle(
  snapshots: readonly QuotaSnapshot[],
  mode: MenuBarDisplayMode = "icon_only",
  frontmostProvider?: string | null,
): string {
  if (mode === "icon_only") {
    return "";
  }

  const active = snapshots.filter((s) => s.status === "ok");
  if (active.length === 0) {
    return "";
  }

  if (mode === "frontmost_app") {
    if (frontmostProvider) {
      const matched = active.find((s) => s.provider === frontmostProvider);
      if (matched && matched.windows.length > 0 && matched.windows[0].remainingPercent != null) {
        return `${matched.windows[0].remainingPercent.toFixed(0)}%`;
      }
    }
    return "";
  }

  if (mode === "lowest_quota") {
    let minSnap: QuotaSnapshot | null = null;
    let minRem = Infinity;

    for (const snap of active) {
      for (const w of snap.windows) {
        if (w.remainingPercent != null && w.remainingPercent < minRem) {
          minRem = w.remainingPercent;
          minSnap = snap;
        }
      }
    }

    if (minSnap && Number.isFinite(minRem)) {
      const prefix = minRem <= 15 ? "⚠️ " : "";
      return `${prefix}${minRem.toFixed(0)}%`;
    }
  }

  if (mode === "wallet_spend") {
    let totalSpend = 0;
    let hasSpend = false;
    for (const snap of active) {
      if (snap.balance && snap.balance.balances) {
        for (const b of snap.balance.balances) {
          if (typeof b.usage === "number") {
            totalSpend += b.usage;
            hasSpend = true;
          }
        }
      }
    }
    if (hasSpend) {
      return `$${totalSpend.toFixed(2)}`;
    }
    // Fallback to highest balance
    for (const snap of active) {
      if (snap.balance?.balances?.[0]?.totalBalance != null) {
        const b = snap.balance.balances[0];
        return b.currency === "CNY"
          ? `¥${b.totalBalance.toFixed(0)}`
          : `$${b.totalBalance.toFixed(2)}`;
      }
    }
  }

  if (mode === "provider_label") {
    const firstWithWindow = active.find(
      (s) => s.windows.length > 0 && s.windows[0]?.remainingPercent != null,
    );
    if (firstWithWindow) {
      const meta = getProviderMeta(firstWithWindow.provider);
      const rem = firstWithWindow.windows[0]?.remainingPercent ?? 0;
      const short = meta.shortName || meta.name;
      const name = short.charAt(0).toUpperCase() + short.slice(1);
      return `${name} ${rem.toFixed(0)}%`;
    }
  }

  // Default: primary_percent
  const primary = active.find((s) => s.windows.length > 0) || active[0];
  if (primary?.windows[0]?.remainingPercent != null) {
    return `${primary.windows[0].remainingPercent.toFixed(0)}%`;
  }
  if (primary?.balance?.balances[0]?.totalBalance != null) {
    const b = primary.balance.balances[0];
    return b.currency === "CNY" ? `¥${b.totalBalance.toFixed(0)}` : `$${b.totalBalance.toFixed(2)}`;
  }

  return "Kuota";
}

export function detectQuotaAlertEvents(
  current: readonly QuotaSnapshot[],
  previous: readonly QuotaSnapshot[],
  threshold = 15,
): QuotaAlertEvent[] {
  const alerts: QuotaAlertEvent[] = [];

  for (const curr of current) {
    if (curr.status !== "ok") continue;
    const prev = previous.find((p) => p.provider === curr.provider);
    if (!prev) continue;

    for (const currWin of curr.windows) {
      if (currWin.remainingPercent == null) continue;
      const prevWin = prev.windows.find((w) => w.windowId === currWin.windowId);
      if (!prevWin || prevWin.remainingPercent == null) continue;

      // Check low quota transition
      if (prevWin.remainingPercent > threshold && currWin.remainingPercent <= threshold) {
        alerts.push({
          type: "low_quota",
          provider: curr.provider,
          windowId: currWin.windowId,
          remainingPercent: currWin.remainingPercent,
          resetAt: currWin.resetAt,
        });
      }

      // Check quota reset transition
      if (prevWin.remainingPercent <= 20 && currWin.remainingPercent >= 80) {
        alerts.push({
          type: "quota_reset",
          provider: curr.provider,
          windowId: currWin.windowId,
          remainingPercent: currWin.remainingPercent,
          resetAt: currWin.resetAt,
        });
      }
    }
  }

  return alerts;
}

export type PromptFormat = "minimal" | "detailed" | "starship";

export function formatPromptString(
  snapshots: readonly QuotaSnapshot[],
  format: PromptFormat = "minimal",
  targetProvider?: string,
): string {
  const active = snapshots.filter((s) => s.status === "ok");
  if (active.length === 0) return "";

  const snap = targetProvider
    ? active.find((s) => s.provider === targetProvider) || active[0]
    : active.find((s) => s.windows.length > 0) || active[0];

  if (!snap) return "";
  const meta = getProviderMeta(snap.provider);
  const name = meta.shortName || meta.name;
  const isExhausted =
    snap.windows.some((w) => (w.remainingPercent ?? 100) <= 0) ||
    snap.errorCode === "QUOTA_EXHAUSTED";

  let val = "";
  if (isExhausted) {
    val = "0%";
  } else if (snap.windows.length > 0 && snap.windows[0]?.remainingPercent != null) {
    val = `${snap.windows[0].remainingPercent.toFixed(0)}%`;
  } else if (snap.balance?.balances?.[0]?.totalBalance != null) {
    const b = snap.balance.balances[0];
    val = b.currency === "USD" ? `$${b.totalBalance.toFixed(0)}` : `¥${b.totalBalance.toFixed(0)}`;
  } else {
    return "";
  }

  if (format === "detailed") {
    return isExhausted ? `[${name}: EXHAUSTED]` : `[${name}: ${val}]`;
  }
  if (format === "starship") {
    return isExhausted ? `󰚩 ⚠️ 0%` : `󰚩 ${val}`;
  }
  return isExhausted ? `⚠️ ${val}` : val;
}
