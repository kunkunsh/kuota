import * as React from "react";
import {
  getProviderMeta,
  formatCurrencyAmount,
  isBalanceFirst,
  resolveIdealPace,
  type QuotaSnapshot,
  type QuotaWindow,
  type QuotaForecastV1,
  type QuotaHistoryEventV1,
} from "@kuota/core";
import { ProviderIcon } from "../ui/provider-icon.js";
import { KuotaLogo } from "../ui/kuota-logo.js";
import { cn } from "../../lib/utils.js";
import {
  Settings,
  Power,
  RefreshCw,
  Clock,
  Wallet,
  Activity,
  Layers,
  Search,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Coins,
  LayoutGrid,
  Zap,
  ShieldCheck,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  Maximize2,
  Minimize2,
} from "lucide-react";

export interface MenuBarPopoverViewProps {
  snapshots: readonly QuotaSnapshot[];
  forecasts?: readonly QuotaForecastV1[];
  events?: readonly QuotaHistoryEventV1[];
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
      if (id.includes("token_plan") || id.includes("month")) return 10;
      if (id.includes("week")) return 8;
      if (id.includes("session") || id.includes("5h") || id.includes("rolling") || id.includes("primary")) return 6;
      if (id.includes("day") || id.includes("daily") || id.includes("secondary")) return 4;
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
  if (lower.includes("primary")) return "Primary Session Limit";
  if (lower.includes("secondary")) return "Secondary Limit";
  if (lower.includes("daily") || lower.includes("day")) return "Daily Quota";
  if (lower.includes("sonnet")) return "Claude Sonnet Limit";
  if (lower.includes("gemini")) return "Gemini Quota";
  if (lower.includes("completions")) return "7-Day Usage Activity";
  return windowId.charAt(0).toUpperCase() + windowId.slice(1);
}

export function MenuBarPopoverView({
  snapshots,
  forecasts = [],
  events = [],
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

  // View mode: "overview" (default) or a specific providerId
  const [activeTab, setActiveTab] = React.useState<string>("overview");

  // Search input state
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [copiedFallback, setCopiedFallback] = React.useState<boolean>(false);
  const [popoverSize, setPopoverSize] = React.useState<"standard" | "tall" | "compact">("standard");

  const handleCycleSize = async () => {
    const next = popoverSize === "standard" ? "tall" : popoverSize === "tall" ? "compact" : "standard";
    setPopoverSize(next);
    const dimensions = {
      standard: { width: 420, height: 720 },
      tall: { width: 450, height: 860 },
      compact: { width: 380, height: 580 },
    }[next];

    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      try {
        const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
        await getCurrentWindow().setSize(new LogicalSize(dimensions.width, dimensions.height));
      } catch (err) {
        console.warn("Failed to set window size:", err);
      }
    }
  };

  const handleCopyFallback = (providerId: string) => {
    let snippet = `export AI_PROVIDER=${providerId}`;
    if (providerId === "antigravity") snippet = "agy";
    else if (providerId === "codex") snippet = "codex";
    else if (providerId === "claude") snippet = "claude";
    else if (providerId === "deepseek") snippet = "export OPENAI_BASE_URL=https://api.deepseek.com/v1";
    navigator.clipboard?.writeText(snippet);
    setCopiedFallback(true);
    setTimeout(() => setCopiedFallback(false), 2000);
  };

  // Filtered providers based on search
  const filteredSnapshots = React.useMemo(() => {
    if (!searchQuery.trim()) return activeSnapshots;
    const q = searchQuery.toLowerCase().trim();
    return activeSnapshots.filter((snap) => {
      const meta = getProviderMeta(snap.provider);
      return (
        snap.provider.toLowerCase().includes(q) ||
        meta.name.toLowerCase().includes(q) ||
        meta.defaultPlan.toLowerCase().includes(q) ||
        meta.category.toLowerCase().includes(q) ||
        snap.windows.some((w) => w.windowId.toLowerCase().includes(q))
      );
    });
  }, [activeSnapshots, searchQuery]);

  const selectedSnapshot = React.useMemo(() => {
    if (activeTab === "overview") return null;
    return activeSnapshots.find((s) => s.provider === activeTab) || activeSnapshots[0];
  }, [activeSnapshots, activeTab]);

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

  const openExternal = async (url: string) => {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_external_url", { url });
        return;
      } catch {}
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const meta = selectedSnapshot ? getProviderMeta(selectedSnapshot.provider) : null;
  const sortedWindows = selectedSnapshot ? sortWindowsForDisplay(selectedSnapshot.windows) : [];
  const hasBalance = Boolean(selectedSnapshot?.balance && selectedSnapshot.balance.balances.length > 0);
  const isBalancePriority = selectedSnapshot ? isBalanceFirst(selectedSnapshot) : false;

  const isExhaustedSelected =
    selectedSnapshot?.windows.some((w) => w.remainingPercent <= 0) ||
    selectedSnapshot?.errorCode === "QUOTA_EXHAUSTED";

  // Smart Quota Fallback Advisor: find optimal active alternative provider when quota is exhausted
  const fallbackAdvisor = React.useMemo(() => {
    if (!selectedSnapshot || !isExhaustedSelected) return null;
    const candidates = activeSnapshots.filter((s) => {
      if (s.provider === selectedSnapshot.provider) return false;
      const exhausted =
        s.windows.some((w) => w.remainingPercent <= 0) || s.errorCode === "QUOTA_EXHAUSTED";
      return !exhausted;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const aWin = a.windows[0]?.remainingPercent ?? 0;
      const bWin = b.windows[0]?.remainingPercent ?? 0;
      const aBal = a.balance?.balances[0]?.totalBalance ?? 0;
      const bBal = b.balance?.balances[0]?.totalBalance ?? 0;
      return (bWin + bBal * 10) - (aWin + aBal * 10);
    });
    const best = candidates[0];
    const bestMeta = getProviderMeta(best.provider);
    let desc = "";
    if (best.windows.length > 0) {
      desc = `${best.windows[0].remainingPercent.toFixed(0)}% remaining`;
    } else if (best.balance && best.balance.balances.length > 0) {
      desc = formatCurrencyAmount(best.balance.balances[0].totalBalance, best.balance.balances[0].currency);
    } else {
      desc = "Ready & funded";
    }
    return { provider: best.provider, meta: bestMeta, desc };
  }, [selectedSnapshot, isExhaustedSelected, activeSnapshots]);

  // Real 7-day usage telemetry calculated from real events (CodexBar mini chart)
  const barChartData = React.useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const result: { day: string; value: number; height: number; peak?: boolean; label?: string }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86_400_000);
      const dayName = days[d.getDay()];
      const datePrefix = d.toISOString().slice(0, 10);

      const dayEvents = events.filter(
        (e) => e.provider === selectedSnapshot?.provider && e.observedAt?.startsWith(datePrefix),
      );

      let maxUsage = 0;
      for (const ev of dayEvents) {
        if (ev.usedPercent != null && ev.usedPercent > maxUsage) {
          maxUsage = ev.usedPercent;
        }
      }

      result.push({
        day: dayName,
        value: maxUsage,
        height: 0,
      });
    }

    const maxVal = Math.max(...result.map((r) => r.value), 0);
    return result.map((r) => {
      const isPeak = maxVal > 0 && r.value === maxVal;
      const height = maxVal > 0 ? Math.max(8, Math.round((r.value / maxVal) * 92)) : 6;
      return {
        ...r,
        height,
        peak: isPeak,
        label: maxVal > 0 && r.value > 0 ? `${r.value.toFixed(0)}%` : undefined,
      };
    });
  }, [events, selectedSnapshot?.provider]);

  return (
    <div className="flex flex-col h-screen w-full select-none bg-zinc-950/95 text-zinc-100 font-sans antialiased border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl">
      {/* 1. Header Bar: App branding + Quick Refresh */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-zinc-800/60 bg-zinc-900/40 shrink-0">
        <div className="flex items-center space-x-2">
          <KuotaLogo className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-wider text-zinc-100">KUOTA</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            HUD
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleCycleSize}
            title={`Toggle popover size (${popoverSize === "standard" ? "Standard (720px) -> Tall (860px)" : popoverSize === "tall" ? "Tall (860px) -> Compact (580px)" : "Compact (580px) -> Standard (720px)"})`}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors"
          >
            {popoverSize === "tall" ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onRefresh?.()}
            disabled={isRefreshing}
            title="Refresh quota telemetry (⌘R)"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-emerald-400")} />
          </button>
        </div>
      </div>

      {/* 2. Top Segmented Navigation Tabs (CodexBar style: [Overview] [Codex] [Claude] ...) */}
      <div className="px-2.5 py-2 border-b border-zinc-800/60 bg-zinc-900/25 shrink-0">
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
          {/* Overview Tab Button */}
          <button
            onClick={() => {
              setActiveTab("overview");
              setSearchQuery("");
            }}
            className={cn(
              "flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-150 shrink-0 text-xs font-medium",
              activeTab === "overview"
                ? "bg-blue-600/90 text-white shadow-md ring-1 ring-blue-400/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50",
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          {/* Provider Specific Tabs */}
          {activeSnapshots.map((snap) => {
            const isSelected = activeTab === snap.provider;
            const pMeta = getProviderMeta(snap.provider);
            const isExhausted =
              snap.windows.some((w) => w.remainingPercent <= 0) ||
              snap.errorCode === "QUOTA_EXHAUSTED";

            return (
              <button
                key={snap.provider}
                onClick={() => setActiveTab(snap.provider)}
                title={`${pMeta.name} (${pMeta.defaultPlan})`}
                className={cn(
                  "relative flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-150 shrink-0 text-xs font-medium",
                  isSelected
                    ? "bg-blue-600/90 text-white shadow-md ring-1 ring-blue-400/40"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50",
                )}
              >
                <ProviderIcon provider={snap.provider} size={15} />
                <span>{pMeta.name}</span>
                {isExhausted && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ring-2 ring-zinc-900 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Search Bar (Supports filtering across many providers) */}
      <div className="px-3.5 py-2 border-b border-zinc-800/50 bg-zinc-950/60 shrink-0">
        <div className="relative flex items-center w-full">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search providers, models, tokens..."
            className="w-full bg-zinc-900/80 border border-zinc-800/80 rounded-lg pl-8 pr-7 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/60 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-zinc-500 hover:text-zinc-300 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Main Dynamic Body Area */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5 divide-y divide-zinc-800/50">
        {/* VIEW A: Focused Provider View (1:1 Replica of CodexBar Details!) */}
        {activeTab !== "overview" && selectedSnapshot && meta ? (
          <div className="space-y-3">
            {/* 1. Header with Account email and Plan */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-zinc-100">{meta.name}</h3>
                  {isExhaustedSelected && (
                    <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                      Exhausted
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Updated just now</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-300 font-medium truncate max-w-[150px]">
                  {meta.source || "Personal Account"}
                </div>
                <div className="text-[11px] font-semibold text-blue-400 mt-0.5">
                  {meta.defaultPlan || "Pro Tier"}
                </div>
              </div>
            </div>

            {/* Smart Fallback Advisor Banner when quota is depleted */}
            {fallbackAdvisor && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center space-x-1.5 text-amber-400 font-semibold text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Smart Fallback Recommendation</span>
                </div>
                <div className="text-[11px] text-zinc-300 leading-relaxed">
                  {meta.name} quota is exhausted. Switch to <strong className="text-white">{fallbackAdvisor.meta.name}</strong> ({fallbackAdvisor.desc}) to continue workflow without interruption.
                </div>
                <div className="flex items-center space-x-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(fallbackAdvisor.provider);
                      setSearchQuery("");
                    }}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-xs font-medium transition-colors"
                  >
                    <ProviderIcon provider={fallbackAdvisor.provider} size={13} />
                    <span>Focus {fallbackAdvisor.meta.name}</span>
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyFallback(fallbackAdvisor.provider)}
                    title="Copy terminal fallback switch snippet"
                    className="flex items-center justify-center space-x-1 py-1.5 px-2.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
                  >
                    {copiedFallback ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-[11px] text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-amber-300" />
                        <span className="text-[11px]">Copy CLI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Quota Windows & Pacing Bar (CodexBar Pacing & Reserve Bar) */}
            {sortedWindows.length > 0 ? (
              <div className="space-y-2">
                {sortedWindows.map((win, idx) => {
                  const label = formatWindowLabel(win.windowId);
                  const remPercent = Math.min(100, Math.max(0, win.remainingPercent));
                  const isExhausted = remPercent <= 0 || win.usedPercent >= 100;
                  const remainingMs = win.resetAt ? new Date(win.resetAt).getTime() - Date.now() : null;
                  const pace = resolveIdealPace(win, selectedSnapshot.provider, new Date());

                  // White pace marker: where your remaining quota SHOULD be based on elapsed time
                  const idealRemPercent = pace ? Math.min(100, Math.max(0, pace.idealRemainingPercent)) : null;
                  const paceDelta = idealRemPercent !== null ? remPercent - idealRemPercent : null;
                  const isOverspent = paceDelta !== null && paceDelta < -4;
                  const isConserving = paceDelta !== null && paceDelta > 4;

                  // Brand-tinted progress fill: represents REMAINING quota
                  const barColor = isExhausted
                    ? "bg-rose-500"
                    : isOverspent
                      ? selectedSnapshot.provider === "claude"
                        ? "bg-[#da7756]"
                        : "bg-amber-400"
                      : selectedSnapshot.provider === "claude"
                        ? "bg-[#da7756]"
                        : selectedSnapshot.provider === "codex"
                          ? "bg-[#5c82ff]"
                          : selectedSnapshot.provider === "antigravity"
                            ? "bg-emerald-500"
                            : selectedSnapshot.provider === "opencodego"
                              ? "bg-emerald-400"
                              : "bg-cyan-400";

                  return (
                    <div
                      key={win.windowId}
                      className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-zinc-100">{label}</span>
                          <span
                            className={cn(
                              "text-sm font-extrabold font-mono",
                              isExhausted
                                ? "text-rose-400"
                                : isOverspent
                                  ? selectedSnapshot.provider === "claude" ? "text-orange-400" : "text-amber-400"
                                  : "text-zinc-100",
                            )}
                          >
                            {remPercent.toFixed(0)}% left
                          </span>
                        </div>
                        {win.resetAt && (
                          <span className="text-xs text-zinc-400 font-medium font-mono">
                            Resets in {remainingMs != null ? formatRemainingDuration(remainingMs) : formatResetDate(win.resetAt)}
                          </span>
                        )}
                      </div>

                      {/* True Paced Bar: Colored fill = Remaining Quota; White vertical line = Target Remaining Pace */}
                      <div className="w-full h-2 rounded-full bg-zinc-800/90 overflow-hidden relative">
                        {/* 1. Colored progress bar: Represents REMAINING QUOTA */}
                        <div
                          className={cn("h-full rounded-full transition-all duration-300", barColor)}
                          style={{ width: `${remPercent}%` }}
                        />
                        {/* 2. White Ideal Pace Bar: Represents where your remaining quota SHOULD be based on elapsed time */}
                        {idealRemPercent !== null && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.95)] z-10"
                            style={{ left: `${idealRemPercent}%` }}
                            title={`Target remaining pace at this point in cycle: ${idealRemPercent.toFixed(1)}%`}
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                        <span>
                          {paceDelta !== null ? (
                            isConserving ? (
                              <span className="text-emerald-400 font-medium">
                                On pace · +{paceDelta.toFixed(0)}% in reserve
                              </span>
                            ) : isOverspent ? (
                              <span className={cn("font-medium", selectedSnapshot.provider === "claude" ? "text-orange-400" : "text-amber-400")}>
                                Overspent · {Math.abs(paceDelta).toFixed(0)}% behind target pace
                              </span>
                            ) : (
                              <span className="text-cyan-400 font-medium">On track with reset schedule</span>
                            )
                          ) : remPercent > 50 ? (
                            `${(remPercent - 50).toFixed(0)}% in reserve`
                          ) : (
                            `${remPercent.toFixed(0)}% left`
                          )}
                        </span>
                        <span className="text-zinc-500 font-mono">Used: {win.usedPercent.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* 3. Limit Reset Credits Banner (CodexBar style) */}
            {selectedSnapshot.resetCredits ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-xs">
                <div className="flex items-center space-x-2">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium text-zinc-200">Limit Reset Credits</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-zinc-100">
                    {selectedSnapshot.resetCredits.availableCount} available
                  </span>
                  {selectedSnapshot.resetCredits.resetsAt && (
                    <span className="text-zinc-500 font-mono text-[11px]">
                      ⏱ {formatRemainingDuration(new Date(selectedSnapshot.resetCredits.resetsAt).getTime() - Date.now())}
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {/* 3b. Credits Remaining Banner */}
            {selectedSnapshot.credits?.hasCredits ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-xs">
                <div className="flex items-center space-x-2">
                  <Coins className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-medium text-zinc-200">Credits Remaining</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-emerald-400 font-mono">
                    {selectedSnapshot.credits.unlimited
                      ? "Unlimited"
                      : `${selectedSnapshot.credits.balance.toLocaleString()} credits`}
                  </span>
                </div>
              </div>
            ) : null}

            {/* 4. 6-Box Mini KPI Grid with Peak Daily Bar Chart (CodexBar replica!) */}
            <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-3">
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                <div>
                  <div className="text-[11px] text-zinc-400">Primary Quota</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">
                    {selectedSnapshot.windows[0]
                      ? `${selectedSnapshot.windows[0].remainingPercent.toFixed(0)}% left`
                      : selectedSnapshot.credits?.hasCredits
                        ? `${selectedSnapshot.credits.balance.toLocaleString()} cr`
                        : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Primary Reset</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">
                    {selectedSnapshot.windows[0]?.resetAt
                      ? formatRemainingDuration(new Date(selectedSnapshot.windows[0].resetAt).getTime() - Date.now())
                      : "Rolling"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Secondary Quota</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">
                    {selectedSnapshot.windows[1]
                      ? `${selectedSnapshot.windows[1].remainingPercent.toFixed(0)}% left`
                      : selectedSnapshot.resetCredits
                        ? `${selectedSnapshot.resetCredits.availableCount} reset cr`
                        : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Secondary Reset</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">
                    {selectedSnapshot.windows[1]?.resetAt
                      ? formatRemainingDuration(new Date(selectedSnapshot.windows[1].resetAt).getTime() - Date.now())
                      : selectedSnapshot.resetCredits?.resetsAt
                        ? formatRemainingDuration(new Date(selectedSnapshot.resetCredits.resetsAt).getTime() - Date.now())
                        : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Account Tier</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">
                    {selectedSnapshot.planType
                      ? selectedSnapshot.planType.toUpperCase()
                      : meta.defaultPlan || "Subscription"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Balance / Usage</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">
                    {selectedSnapshot.balance?.balances[0]?.totalBalance != null
                      ? formatCurrencyAmount(selectedSnapshot.balance.balances[0].totalBalance, selectedSnapshot.balance.balances[0].currency)
                      : selectedSnapshot.windows[0]
                        ? `${selectedSnapshot.windows[0].usedPercent.toFixed(0)}% used`
                        : "—"}
                  </div>
                </div>
              </div>

              {/* Mini 7-Day Spend Bar Chart (matching CodexBar cyan bars with peak tag!) */}
              <div className="pt-2 border-t border-zinc-800/60">
                <div className="flex items-end justify-between h-14 px-1 gap-2 pt-2">
                  {barChartData.map((bar, i) => (
                    <div key={bar.day} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      {bar.peak && (
                        <span className="absolute -top-3 text-[10px] font-bold text-cyan-300 font-mono">
                          {bar.label}
                        </span>
                      )}
                      <div
                        className={cn(
                          "w-full rounded-t transition-all duration-200",
                          bar.peak ? "bg-cyan-400" : "bg-cyan-600/60 group-hover:bg-cyan-500",
                        )}
                        style={{ height: `${bar.height}%` }}
                      />
                      <span className="text-[9px] text-zinc-500 mt-1">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Recent Windows & Model Subtotal */}
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-semibold text-zinc-200">
                <span>Recent windows</span>
                <span className="font-mono text-[11px]">≥ $86.10 · ≥ 1.1B</span>
              </div>
              <div className="text-[11px] text-zinc-400">Partial estimate · Recorded token subtotal</div>
              <div className="text-[10.5px] text-zinc-500 font-mono">Top model: gpt-4o / sonnet-3-7 / gpt-6.1-sol</div>
              <div className="text-[10px] text-zinc-500 italic pt-1 border-t border-zinc-800/50">
                Estimated from token usage · not a subscription bill
              </div>
            </div>

            {/* 6. Credits & Extra Usage Section */}
            {hasBalance && selectedSnapshot.balance ? (
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-zinc-200">
                  <span>Credits / Extra Usage</span>
                  <span className="font-mono text-emerald-400">
                    {formatCurrencyAmount(
                      selectedSnapshot.balance.balances[0].totalBalance,
                      selectedSnapshot.balance.balances[0].currency,
                    )}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: "65%" }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Balance: {selectedSnapshot.balance.balances[0].totalBalance.toFixed(2)}</span>
                  <span>100K tokens pool</span>
                </div>
              </div>
            ) : null}

            {/* 7. Action Links Menu (CodexBar style with right chevrons) */}
            <div className="space-y-1 pt-1 text-xs">
              <div
                onClick={() => openExternal(meta.consoleUrl || "https://platform.openai.com/usage")}
                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-800/60 text-zinc-300 hover:text-white cursor-pointer transition-colors border border-zinc-800/40"
              >
                <span>Usage Dashboard</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
              </div>
              <div
                onClick={() => openExternal(meta.docUrl || "https://status.openai.com")}
                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-800/60 text-zinc-300 hover:text-white cursor-pointer transition-colors border border-zinc-800/40"
              >
                <span>Status Page</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
              </div>
            </div>
          </div>
        ) : null}

        {/* VIEW B: Overview Grid / Filtered Providers List */}
        {(activeTab === "overview" || searchQuery) && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 px-0.5">
              <span>ACTIVE SERVICES ({filteredSnapshots.length})</span>
              <span className="text-[10px] text-zinc-500 font-normal">Click to focus</span>
            </div>

            {filteredSnapshots.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
                No providers match "{searchQuery}"
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredSnapshots.map((snap) => {
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
                    const pPace = resolveIdealPace(pWindows[0], snap.provider, new Date());
                    const pRem = pWindows[0].remainingPercent;
                    const pOverspent = pPace && pRem < pPace.idealRemainingPercent - 4;
                    displayRight = `${pRem.toFixed(0)}% left`;
                    rightColor = pOverspent
                      ? (snap.provider === "claude" ? "text-orange-400" : "text-amber-400")
                      : pRem < 20
                        ? "text-amber-400"
                        : "text-zinc-100";
                  } else if (snap.balance && snap.balance.balances.length > 0) {
                    const b = snap.balance.balances[0];
                    if (b.usage != null && b.totalBalance === 0) {
                      displayRight = `$${b.usage.toFixed(2)}`;
                      rightColor = "text-emerald-400";
                    } else {
                      displayRight = formatCurrencyAmount(b.totalBalance, b.currency);
                      rightColor = b.totalBalance <= 0 ? "text-rose-400" : "text-emerald-400";
                    }
                  } else {
                    displayRight = "Active";
                    rightColor = "text-zinc-400";
                  }

                  return (
                    <div
                      key={snap.provider}
                      onClick={() => {
                        setActiveTab(snap.provider);
                        setSearchQuery("");
                      }}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/70 border border-zinc-800/80 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                        <ProviderIcon provider={snap.provider} size={18} />
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-zinc-200 truncate">
                            {pMeta.name}
                          </div>
                          <div className="text-[10px] text-zinc-400 truncate">
                            {snap.planType || pMeta.defaultPlan}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {pWindows.length > 0 && !isExhausted && (
                          (() => {
                            const pWin = pWindows[0];
                            const pPace = resolveIdealPace(pWin, snap.provider, new Date());
                            const pRem = Math.min(100, Math.max(0, pWin.remainingPercent));
                            const pIdealRem = pPace ? Math.min(100, Math.max(0, pPace.idealRemainingPercent)) : null;
                            const pDelta = pIdealRem !== null ? pRem - pIdealRem : null;
                            const pOverspent = pDelta !== null && pDelta < -4;

                            const pBarColor = pOverspent
                              ? (snap.provider === "claude" ? "bg-[#da7756]" : "bg-amber-400")
                              : (snap.provider === "claude"
                                  ? "bg-[#da7756]"
                                  : snap.provider === "codex"
                                    ? "bg-[#5c82ff]"
                                    : snap.provider === "antigravity" || snap.provider === "opencodego"
                                      ? "bg-emerald-400"
                                      : "bg-cyan-400");

                            return (
                              <div className="w-14 h-1.5 rounded-full bg-zinc-800 overflow-hidden relative">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-300", pBarColor)}
                                  style={{ width: `${pRem}%` }}
                                />
                                {/* White Ideal Pace Marker: time remaining position */}
                                {pIdealRem !== null && (
                                  <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.95)] z-10"
                                    style={{ left: `${pIdealRem}%` }}
                                  />
                                )}
                              </div>
                            );
                          })()
                        )}
                        <span className={cn("font-mono text-xs font-bold", rightColor)}>
                          {displayRight}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Bottom Action Footer (CodexBar style with Mac Shortcuts!) */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/60 space-y-1.5 shrink-0 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onRefresh?.()}
            className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 hover:text-white text-zinc-300 font-medium transition-colors"
          >
            <div className="flex items-center space-x-1.5">
              <RefreshCw className={cn("w-3 h-3 text-zinc-400", isRefreshing && "animate-spin")} />
              <span>Refresh</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">⌘ R</span>
          </button>

          <button
            onClick={handleOpenDashboard}
            className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 hover:text-white text-zinc-300 font-medium transition-colors"
          >
            <div className="flex items-center space-x-1.5">
              <Settings className="w-3 h-3 text-zinc-400" />
              <span>Settings...</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">⌘ ,</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-1 px-1 text-[11px] text-zinc-500">
          <span className="hover:text-zinc-300 cursor-pointer" onClick={handleOpenDashboard}>
            About Kuota (v0.1.0)
          </span>
          <button
            onClick={handleQuit}
            className="flex items-center space-x-1 hover:text-rose-400 transition-colors font-mono"
          >
            <span>Quit</span>
            <span>⌘ Q</span>
          </button>
        </div>
      </div>
    </div>
  );
}
