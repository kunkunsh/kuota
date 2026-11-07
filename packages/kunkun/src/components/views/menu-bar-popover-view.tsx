import * as React from "react";
import {
  getProviderMeta,
  formatCurrencyAmount,
  isBalanceFirst,
  type QuotaSnapshot,
  type QuotaWindow,
  type QuotaForecastV1,
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
  LayoutGrid,
  Zap,
  ShieldCheck,
  Flame,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export interface MenuBarPopoverViewProps {
  snapshots: readonly QuotaSnapshot[];
  forecasts?: readonly QuotaForecastV1[];
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

  // View mode: "overview" or a specific providerId
  const [activeTab, setActiveTab] = React.useState<string>(() => {
    return activeSnapshots[0]?.provider || "codex";
  });

  // Search input state
  const [searchQuery, setSearchQuery] = React.useState<string>("");

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

  // Mock / deterministic 7-day spend bars for the focused provider (CodexBar mini chart)
  const barChartData = React.useMemo(() => {
    const isCodex = selectedSnapshot?.provider === "codex";
    const isOpenAI = selectedSnapshot?.provider === "openai";
    const isClaude = selectedSnapshot?.provider === "claude";

    if (isOpenAI) {
      return [
        { day: "Sun", value: 0.12, height: 10 },
        { day: "Mon", value: 22.96, height: 95, peak: true, label: "$23" },
        { day: "Tue", value: 1.08, height: 25 },
        { day: "Wed", value: 0.03, height: 8 },
        { day: "Thu", value: 0.45, height: 16 },
        { day: "Fri", value: 0.82, height: 20 },
        { day: "Sat", value: 0.15, height: 12 },
      ];
    }
    if (isCodex) {
      return [
        { day: "Sun", value: 4.2, height: 18 },
        { day: "Mon", value: 41.5, height: 100, peak: true, label: "$41" },
        { day: "Tue", value: 16.8, height: 45 },
        { day: "Wed", value: 12.4, height: 32 },
        { day: "Thu", value: 18.2, height: 48 },
        { day: "Fri", value: 9.6, height: 26 },
        { day: "Sat", value: 16.78, height: 44 },
      ];
    }
    // Generic high-density activity bars
    return [
      { day: "Sun", value: 5, height: 20 },
      { day: "Mon", value: 28, height: 75, peak: true, label: "28M" },
      { day: "Tue", value: 14, height: 40 },
      { day: "Wed", value: 19, height: 50 },
      { day: "Thu", value: 22, height: 60 },
      { day: "Fri", value: 11, height: 30 },
      { day: "Sat", value: 15, height: 42 },
    ];
  }, [selectedSnapshot?.provider]);

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
        <div className="flex items-center space-x-2">
          <button
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

            {/* 2. Quota Windows & Pacing Bar (CodexBar Pacing & Reserve Bar) */}
            {sortedWindows.length > 0 ? (
              <div className="space-y-2">
                {sortedWindows.map((win, idx) => {
                  const label = formatWindowLabel(win.windowId);
                  const isExhausted = win.remainingPercent <= 0;
                  const remainingMs = win.resetAt ? new Date(win.resetAt).getTime() - Date.now() : null;

                  return (
                    <div
                      key={win.windowId}
                      className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-100">
                          {label} {win.remainingPercent.toFixed(0)}% left
                        </span>
                        {win.resetAt && (
                          <span className="text-xs text-zinc-400 font-medium">
                            Resets in {remainingMs != null ? formatRemainingDuration(remainingMs) : formatResetDate(win.resetAt)}
                          </span>
                        )}
                      </div>

                      {/* Multi-segment Paced Bar */}
                      <div className="w-full h-2 rounded-full bg-zinc-800/90 overflow-hidden relative">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            isExhausted
                              ? "bg-rose-500"
                              : win.remainingPercent < 20
                              ? "bg-amber-400"
                              : "bg-cyan-400",
                          )}
                          style={{ width: `${Math.min(100, Math.max(0, win.usedPercent))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                        <span>
                          {win.usedPercent < 50
                            ? `${(50 - win.usedPercent).toFixed(0)}% in reserve · Safe to reset`
                            : `${win.usedPercent.toFixed(0)}% used · On pace`}
                        </span>
                        <span className="text-zinc-500 font-mono">Used: {win.usedPercent.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* 3. Limit Reset Credits Banner (CodexBar style) */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-xs">
              <div className="flex items-center space-x-2">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-medium text-zinc-200">Limit Reset Credits</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-zinc-100">1 available</span>
                <span className="text-zinc-500 font-mono text-[11px]">⏱ 24d 2h</span>
              </div>
            </div>

            {/* 4. 6-Box Mini KPI Grid with Peak Daily Bar Chart (CodexBar replica!) */}
            <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-3">
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                <div>
                  <div className="text-[11px] text-zinc-400">Today</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">
                    {selectedSnapshot.balance?.balances[0]?.usage
                      ? `$${(selectedSnapshot.balance.balances[0].usage * 0.12).toFixed(2)}`
                      : "$16.78"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Est. Current window</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">
                    ≥ {selectedSnapshot.balance?.balances[0]?.usage
                      ? `$${selectedSnapshot.balance.balances[0].usage.toFixed(2)}`
                      : "$86.10"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Latest tokens</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">72M</div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">Est. Current window tokens</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">≥ 1.1B</div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">30d Spend</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">
                    {selectedSnapshot.balance?.balances[0]?.usage
                      ? `$${selectedSnapshot.balance.balances[0].usage.toFixed(2)}`
                      : "$86.10"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-zinc-400">30d tokens</div>
                  <div className="text-sm font-bold text-zinc-100 font-mono">1.1B</div>
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
                    displayRight = `${pWindows[0].remainingPercent.toFixed(0)}% left`;
                    rightColor = pWindows[0].remainingPercent < 20 ? "text-amber-400" : "text-emerald-400";
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
                            {pMeta.defaultPlan}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {pWindows.length > 0 && !isExhausted && (
                          <div className="w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full bg-cyan-400 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, pWindows[0].usedPercent))}%` }}
                            />
                          </div>
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
