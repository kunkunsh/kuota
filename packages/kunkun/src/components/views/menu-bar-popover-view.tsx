import * as React from "react";
import {
  getProviderMeta,
  formatCurrencyAmount,
  isBalanceFirst,
  type QuotaSnapshot,
  type QuotaWindow,
} from "@kuota/core";
import { ProviderIcon } from "../ui/provider-icon.js";
import { PacedProgress } from "../paced-progress.js";
import { KuotaLogo } from "../ui/kuota-logo.js";
import { cn } from "../../lib/utils.js";
import {
  Settings,
  Power,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Wallet,
  Activity,
  Layers,
} from "lucide-react";

export interface MenuBarPopoverViewProps {
  snapshots: readonly QuotaSnapshot[];
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onOpenDashboard?: () => void;
  onQuit?: () => void;
}

function formatRemainingDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return "Now";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatResetDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const m = monthNames[date.getMonth()];
    const d = date.getDate();
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${m} ${d} ${hh}:${mm}`;
  } catch {
    return dateStr;
  }
}

function sortWindowsForDisplay(windows: readonly QuotaWindow[]): QuotaWindow[] {
  return [...windows].sort((a, b) => {
    const getScore = (w: QuotaWindow) => {
      const id = w.windowId.toLowerCase();
      if (id.includes("month")) return 10;
      if (id.includes("week")) return 8;
      if (id.includes("session") || id.includes("5h") || id.includes("rolling")) return 6;
      if (id.includes("day") || id.includes("daily")) return 4;
      return 1;
    };
    return getScore(b) - getScore(a);
  });
}

function formatWindowLabel(windowId: string): string {
  const lower = windowId.toLowerCase();
  if (lower.includes("token_plan") || lower.includes("token-plan")) return "Monthly Token Plan";
  if (lower.includes("month")) return "Monthly Limit";
  if (lower.includes("week")) return "Weekly Quota";
  if (lower.includes("session") || lower.includes("rolling")) return "5-Hour Session Window";
  if (lower.includes("5h")) return "5-Hour Session Window";
  if (lower.includes("daily") || lower.includes("day")) return "Daily Quota";
  return windowId;
}

export function MenuBarPopoverView({
  snapshots,
  isRefreshing = false,
  onRefresh,
  onOpenDashboard,
  onQuit,
}: MenuBarPopoverViewProps) {
  // Only show active/configured providers
  const activeSnapshots = React.useMemo(() => {
    return snapshots.filter((s) => {
      if (s.status === "ok") return true;
      if (s.windows && s.windows.length > 0) return true;
      if (s.balance && s.balance.balances && s.balance.balances.length > 0) return true;
      return false;
    });
  }, [snapshots]);

  const [selectedProviderId, setSelectedProviderId] = React.useState<string>(() => {
    return activeSnapshots[0]?.provider || "claude";
  });

  // If selected provider is not in active list, select first available
  React.useEffect(() => {
    if (activeSnapshots.length > 0 && !activeSnapshots.some((s) => s.provider === selectedProviderId)) {
      setSelectedProviderId(activeSnapshots[0].provider);
    }
  }, [activeSnapshots, selectedProviderId]);

  const selectedSnapshot = React.useMemo(() => {
    return activeSnapshots.find((s) => s.provider === selectedProviderId) || activeSnapshots[0];
  }, [activeSnapshots, selectedProviderId]);

  const handleOpenDashboard = async () => {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_dashboard_window");
        return;
      } catch (err) {
        console.warn("Failed to invoke open_dashboard_window:", err);
      }
    }
    onOpenDashboard?.();
  };

  const handleQuit = async () => {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("exit_app");
        return;
      } catch (err) {
        console.warn("Failed to invoke exit_app:", err);
      }
    }
    onQuit?.();
  };

  const meta = selectedSnapshot ? getProviderMeta(selectedSnapshot.provider) : null;
  const sortedWindows = selectedSnapshot ? sortWindowsForDisplay(selectedSnapshot.windows) : [];
  const hasBalance = Boolean(selectedSnapshot?.balance && selectedSnapshot.balance.balances.length > 0);
  const isBalancePriority = selectedSnapshot ? isBalanceFirst(selectedSnapshot) : false;

  return (
    <div className="flex flex-col h-screen w-full select-none bg-zinc-950/95 text-zinc-100 font-sans antialiased border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl">
      {/* 1. Header Bar: App branding + Quick Refresh */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-zinc-800/60 bg-zinc-900/40">
        <div className="flex items-center space-x-2">
          <KuotaLogo className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-wider text-zinc-200">KUOTA</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            HUD
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onRefresh?.()}
            disabled={isRefreshing}
            title="Refresh quota telemetry"
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-emerald-400")} />
          </button>
        </div>
      </div>

      {/* 2. Top Horizontal Provider Tab Strip (Stats / vorssaint icon row) */}
      <div className="px-2 py-2 border-b border-zinc-800/50 bg-zinc-900/20">
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
          {activeSnapshots.map((snap) => {
            const isSelected = snap.provider === selectedProviderId;
            const pMeta = getProviderMeta(snap.provider);
            const isExhausted =
              snap.windows.some((w) => w.remainingPercent <= 0) ||
              snap.errorCode === "QUOTA_EXHAUSTED";

            return (
              <button
                key={snap.provider}
                onClick={() => setSelectedProviderId(snap.provider)}
                title={`${pMeta.displayName} (${pMeta.badge})`}
                className={cn(
                  "relative flex items-center justify-center p-2 rounded-xl transition-all duration-150 shrink-0",
                  isSelected
                    ? "bg-zinc-800 text-white shadow-md ring-1 ring-white/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50",
                )}
              >
                <ProviderIcon provider={snap.provider} size={18} />
                {isExhausted && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-zinc-900" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Content Area */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 divide-y divide-zinc-800/50">
        {selectedSnapshot && meta ? (
          <div className="space-y-3">
            {/* Provider title and badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ProviderIcon provider={selectedSnapshot.provider} size={20} />
                <div>
                  <div className="text-sm font-semibold text-zinc-100 leading-tight">
                    {meta.displayName}
                  </div>
                  <div className="text-[11px] text-zinc-400">{meta.badge}</div>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
                {selectedSnapshot.billingModel === "subscription" ? "Subscription" : "Wallet"}
              </span>
            </div>

            {/* Quota / Balance Hero Stat */}
            {isBalancePriority && hasBalance ? (
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                <div className="text-[11px] font-medium text-zinc-400 flex items-center space-x-1.5">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {selectedSnapshot.balance!.balances[0].usage != null &&
                    selectedSnapshot.balance!.balances[0].totalBalance === 0
                      ? "Monthly Platform Spend"
                      : "Available Balance"}
                  </span>
                </div>
                {/* Dual Currency, Single Currency, or Monthly Spend */}
                {selectedSnapshot.balance!.balances[0].usage != null &&
                selectedSnapshot.balance!.balances[0].totalBalance === 0 ? (
                  <div className="space-y-0.5">
                    <div className="text-2xl font-bold tracking-tight text-zinc-100 flex items-baseline space-x-1.5">
                      <span>${selectedSnapshot.balance!.balances[0].usage.toFixed(2)}</span>
                      <span className="text-xs text-zinc-400 font-semibold uppercase">USD</span>
                      <span className="text-[11px] text-zinc-500 font-normal">(Nov Spend)</span>
                    </div>
                  </div>
                ) : selectedSnapshot.balance!.balances.length > 1 ? (
                  <div className="space-y-1">
                    <div className="text-xl font-bold tracking-tight text-zinc-100 flex items-baseline space-x-1.5">
                      <span>
                        {formatCurrencyAmount(
                          selectedSnapshot.balance!.balances[0].totalBalance,
                          selectedSnapshot.balance!.balances[0].currency,
                        )}
                      </span>
                      <span className="text-zinc-500 font-normal text-xs">+</span>
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          selectedSnapshot.balance!.balances[1].totalBalance < 0
                            ? "text-rose-400"
                            : "text-zinc-300",
                        )}
                      >
                        {formatCurrencyAmount(
                          selectedSnapshot.balance!.balances[1].totalBalance,
                          selectedSnapshot.balance!.balances[1].currency,
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-2xl font-bold tracking-tight text-zinc-100">
                    {formatCurrencyAmount(
                      selectedSnapshot.balance!.balances[0].totalBalance,
                      selectedSnapshot.balance!.balances[0].currency,
                    )}
                  </div>
                )}
                {/* Cash vs Grant Breakdown or Spend Breakdown */}
                {selectedSnapshot.balance!.balances[0].usage != null &&
                selectedSnapshot.balance!.balances[0].totalBalance === 0 ? (
                  <div className="pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400 flex items-center justify-between">
                    <span>Scope: <code className="text-zinc-300 font-mono">api.usage.read</code></span>
                    <span className="text-emerald-400 font-medium">Admin Verified</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60 text-[11px]">
                    <div>
                      <span className="text-zinc-500">Topped-up Cash: </span>
                      <span className="text-zinc-300 font-mono">
                        {formatCurrencyAmount(
                          selectedSnapshot.balance!.balances[0].cashBalance,
                          selectedSnapshot.balance!.balances[0].currency,
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Granted Credit: </span>
                      <span className="text-zinc-300 font-mono">
                        {formatCurrencyAmount(
                          selectedSnapshot.balance!.balances[0].grantedBalance,
                          selectedSnapshot.balance!.balances[0].currency,
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : sortedWindows.length > 0 ? (
              <div className="space-y-2.5">
                {/* Render Each Window Progress Bar (Support 2 lines: monthly + 5-hour window!) */}
                {sortedWindows.map((win, idx) => {
                  const isPrimary = idx === 0;
                  const isExhausted = win.remainingPercent <= 0;
                  const label = formatWindowLabel(win.windowId);
                  const remainingMs = win.resetAt ? new Date(win.resetAt).getTime() - Date.now() : null;

                  return (
                    <div
                      key={win.windowId}
                      className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-200">{label}</span>
                        <span
                          className={cn(
                            "font-bold font-mono",
                            isExhausted
                              ? "text-rose-400"
                              : win.remainingPercent < 20
                              ? "text-amber-400"
                              : "text-emerald-400",
                          )}
                        >
                          {isExhausted
                            ? "100% Used"
                            : `${win.remainingPercent.toFixed(0)}% Left`}
                        </span>
                      </div>

                      {/* High-density Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden relative">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            isExhausted
                              ? "bg-rose-500"
                              : win.remainingPercent < 20
                              ? "bg-amber-500"
                              : "bg-indigo-500",
                          )}
                          style={{ width: `${Math.min(100, Math.max(0, win.usedPercent))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                        <span>Used: {win.usedPercent.toFixed(0)}%</span>
                        {win.resetAt && (
                          <span className="flex items-center space-x-1 text-zinc-400">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            <span>
                              Resets: {remainingMs != null ? formatRemainingDuration(remainingMs) : formatResetDate(win.resetAt)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center text-xs text-zinc-400">
                Key validated · Usage details require admin scope
              </div>
            )}
          </div>
        ) : null}

        {/* 4. Quick Overview List of All Tracked Providers */}
        <div className="pt-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 px-0.5">
            <span>TRACKED SERVICES ({activeSnapshots.length})</span>
            <span className="text-[10px] text-zinc-500">Click to inspect</span>
          </div>

          <div className="space-y-1">
            {activeSnapshots.map((snap) => {
              const isSelected = snap.provider === selectedProviderId;
              const pMeta = getProviderMeta(snap.provider);
              const pWindows = sortWindowsForDisplay(snap.windows);
              const isExhausted =
                snap.windows.some((w) => w.remainingPercent <= 0) ||
                snap.errorCode === "QUOTA_EXHAUSTED";

              let displayRight = "";
              let rightColor = "text-zinc-300";

              if (isExhausted) {
                displayRight = "Exhausted";
                rightColor = "text-rose-400";
              } else if (pWindows.length > 0) {
                displayRight = `${pWindows[0].remainingPercent.toFixed(0)}% left`;
                rightColor = pWindows[0].remainingPercent < 20 ? "text-amber-400" : "text-emerald-400";
              } else if (snap.balance && snap.balance.balances.length > 0) {
                const b = snap.balance.balances[0];
                displayRight = formatCurrencyAmount(b.totalBalance, b.currency);
                rightColor = b.totalBalance <= 0 ? "text-rose-400" : "text-emerald-400";
              } else {
                displayRight = "Active";
                rightColor = "text-zinc-400";
              }

              return (
                <div
                  key={snap.provider}
                  onClick={() => setSelectedProviderId(snap.provider)}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-colors",
                    isSelected
                      ? "bg-zinc-800/80 text-zinc-100 border border-zinc-700/60"
                      : "hover:bg-zinc-900/70 text-zinc-300 border border-transparent",
                  )}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <ProviderIcon provider={snap.provider} size={16} />
                    <span className="font-medium truncate">{pMeta.displayName}</span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {/* Mini visual bar if window exists */}
                    {pWindows.length > 0 && !isExhausted && (
                      <div className="w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, pWindows[0].usedPercent))}%` }}
                        />
                      </div>
                    )}
                    <span className={cn("font-mono text-[11px] font-semibold", rightColor)}>
                      {displayRight}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Bottom Action Footer (matching user's screenshot [Settings] [Quit]) */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/50 grid grid-cols-2 gap-2">
        <button
          onClick={handleOpenDashboard}
          className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 hover:text-white text-zinc-300 text-xs font-medium border border-zinc-700/50 transition-colors shadow-sm active:scale-[0.98]"
        >
          <Settings className="w-3.5 h-3.5 text-zinc-400" />
          <span>Settings</span>
        </button>

        <button
          onClick={handleQuit}
          className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-zinc-800/80 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-900/60 text-zinc-300 text-xs font-medium border border-zinc-700/50 transition-colors shadow-sm active:scale-[0.98]"
        >
          <Power className="w-3.5 h-3.5 text-zinc-400" />
          <span>Quit</span>
        </button>
      </div>
    </div>
  );
}
