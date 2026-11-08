import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { PacedProgress } from "../paced-progress.js";
import { ProviderIcon } from "../ui/provider-icon.js";
import { cn } from "../../lib/utils.js";
import {
  calculatePace,
  resolveIdealPace,
  windowProfile,
  getProviderMeta,
  formatCurrencyAmount,
  isBalanceFirst,
  PROVIDER_CATALOG,
  type QuotaSnapshot,
  type QuotaForecastV1,
  type QuotaWindow,
} from "@kuota/core";
import {
  AlertTriangle,
  Layers,
  Clock,
  ArrowRight,
  SlidersHorizontal,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import { useI18n } from "../../lib/i18n.js";

export interface OverviewViewProps {
  snapshots: readonly QuotaSnapshot[];
  forecasts?: readonly QuotaForecastV1[];
  series?: Readonly<Record<string, readonly number[]>>;
  now?: Date;
  onSelectProvider?: (id: string) => void;
  onViewHistory?: () => void;
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

function formatResetDate(date: Date): string {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const m = monthNames[date.getMonth()];
  const d = date.getDate();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${m} ${d} ${hh}:${mm}`;
}

// Window priority sorting: Monthly > Weekly > Session/Daily > others
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
  if (lower.includes("session") || lower.includes("rolling")) return "Session Window (5h)";
  if (lower.includes("5h")) return "5-Hour Session";
  if (lower.includes("daily") || lower.includes("day")) return "Daily Quota";
  return windowId;
}

export function OverviewView({
  snapshots,
  forecasts = [],
  series = {},
  now = new Date(),
  onSelectProvider,
  onViewHistory,
}: OverviewViewProps) {
  const { t } = useI18n();
  let filter: "all" | "subscription" | "balance" = "all";
  let setFilter: (f: "all" | "subscription" | "balance") => void = () => {};
  let visibility: Record<string, boolean> = {};
  let setVisibility: React.Dispatch<React.SetStateAction<Record<string, boolean>>> = () => {};
  let showCustomizeModal = false;
  let setShowCustomizeModal: (open: boolean) => void = () => {};

  try {
    const [f, sf] = React.useState<"all" | "subscription" | "balance">("all");
    filter = f;
    setFilter = sf;

    const [vis, setVis] = React.useState<Record<string, boolean>>(() => {
      try {
        const stored = localStorage.getItem("kuota_provider_visibility");
        if (stored) return JSON.parse(stored);
      } catch {
        // ignore
      }
      return {};
    });
    visibility = vis;
    setVisibility = setVis;

    const [modal, setModal] = React.useState(false);
    showCustomizeModal = modal;
    setShowCustomizeModal = setModal;
  } catch {
    filter = "all";
  }

  // Load backend visibility configuration if available
  try {
    React.useEffect(() => {
      async function loadConfig() {
        try {
          if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
            const { invoke } = await import("@tauri-apps/api/core");
            const cfg = (await invoke("get_user_config")) as { visibility?: Record<string, boolean> };
            if (cfg && cfg.visibility && Object.keys(cfg.visibility).length > 0) {
              setVisibility((prev) => ({ ...cfg.visibility, ...prev }));
            }
          } else {
            const res = await fetch("/api/config");
            if (res.ok) {
              const data = await res.json();
              if (data.visibility && Object.keys(data.visibility).length > 0) {
                setVisibility((prev) => ({ ...data.visibility, ...prev }));
              }
            }
          }
        } catch {
          // ignore
        }
      }
      void loadConfig();
    }, []);
  } catch {
    // ignore in non-dispatcher test execution
  }

  const handleToggleVisibility = (providerId: string) => {
    setVisibility((prev) => {
      const next = { ...prev, [providerId]: !prev[providerId] };
      try {
        localStorage.setItem("kuota_provider_visibility", JSON.stringify(next));
      } catch {
        // ignore
      }
      // Persist to backend / config.json asynchronously
      void (async () => {
        try {
          if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("save_user_config", { config: { version: 1, visibility: next } });
          } else {
            await fetch("/api/config", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ visibility: next }),
            });
          }
        } catch {
          // ignore
        }
      })();
      return next;
    });
  };

  // Helper: check if a provider is configured and has active telemetry
  const isProviderConfigured = (s: QuotaSnapshot): boolean => {
    if (s.status === "ok") return true;
    if (s.windows && s.windows.length > 0) return true;
    if (s.balance && s.balance.balances && s.balance.balances.length > 0) return true;
    return false;
  };

  // Determine visibility: explicit preference overrides; default = only show configured
  const shouldDisplayProvider = (s: QuotaSnapshot): boolean => {
    if (visibility[s.provider] !== undefined) {
      return visibility[s.provider];
    }
    return isProviderConfigured(s);
  };

  // Visible snapshots in overview
  const displayedSnapshots = snapshots.filter(shouldDisplayProvider);

  // Aggregate stats directly from displayed snapshots
  const trackedCount = displayedSnapshots.length;
  const totalWindows = displayedSnapshots.reduce((acc, s) => acc + s.windows.length, 0);
  const totalWallets = displayedSnapshots.reduce(
    (acc, s) => acc + (s.balance?.balances.length ? 1 : 0),
    0,
  );

  // Collect real window reset countdowns
  const allResets = displayedSnapshots
    .flatMap((s) => s.windows)
    .map((w) => (w.resetAt ? new Date(w.resetAt).getTime() - now.getTime() : null))
    .filter((ms): ms is number => ms !== null && ms > 0);
  const nearestResetMs = allResets.length > 0 ? Math.min(...allResets) : null;

  // Real at-risk count
  const atRiskCount = displayedSnapshots.reduce((acc, s) => {
    let count = 0;
    count += s.windows.filter((w) => {
      if (w.remainingPercent !== null && w.remainingPercent <= 20) return true;
      const f = forecasts.find((fc) => fc.provider === s.provider && fc.windowId === w.windowId);
      return f?.exhaustedAt !== null && f?.exhaustedAt !== undefined;
    }).length;

    if (s.balance?.balances) {
      for (const b of s.balance.balances) {
        const threshold = b.currency === "CNY" ? 7 : 1;
        if (b.totalBalance <= threshold) {
          count += 1;
        }
      }
    }
    return acc + count;
  }, 0);

  // Filtered snapshots according to tab
  const filteredSnapshots = displayedSnapshots.filter((s) => {
    if (filter === "all") return true;
    if (filter === "subscription") {
      return s.billingModel === "subscription" || (s.windows.length > 0 && !isBalanceFirst(s));
    }
    if (filter === "balance") {
      return s.billingModel === "balance" || s.billingModel === "hybrid" || isBalanceFirst(s);
    }
    return true;
  });

  // Dynamic real upcoming resets sorted chronologically
  const upcomingResets = displayedSnapshots
    .flatMap((s) =>
      s.windows.map((w) => {
        const resetDate = w.resetAt ? new Date(w.resetAt) : null;
        const resetMs = resetDate ? resetDate.getTime() - now.getTime() : null;
        return {
          provider: s.provider,
          scope: w.windowId,
          usedPercent: w.usedPercent,
          remainingPercent: w.remainingPercent,
          resetDate,
          resetMs,
        };
      }),
    )
    .filter((w) => w.resetDate !== null && (w.resetMs ?? 0) > 0)
    .sort((a, b) => (a.resetMs ?? 0) - (b.resetMs ?? 0));

  return (
    <div className="flex flex-col space-y-6">
      {/* (0) Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">KUOTA</h2>
            <Badge
              variant="outline"
              className="text-[11px] text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 border-slate-300 dark:border-zinc-700"
            >
              Multi-Provider Telemetry
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Unified subscription quota pacing, prepaid wallet balances, and limit forecasting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Pills */}
          <div className="flex rounded-lg bg-slate-200/60 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                filter === "all"
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200",
              )}
              onClick={() => setFilter("all")}
            >
              All ({displayedSnapshots.length})
            </button>
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                filter === "subscription"
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200",
              )}
              onClick={() => setFilter("subscription")}
            >
              Quota
            </button>
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                filter === "balance"
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200",
              )}
              onClick={() => setFilter("balance")}
            >
              Wallets
            </button>
          </div>

          {/* Customize View Button */}
          <button
            type="button"
            onClick={() => setShowCustomizeModal(true)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-xs transition-colors cursor-pointer shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
            <span>Customize</span>
          </button>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium">{trackedCount} Shown</span>
          </div>
        </div>
      </div>

      {/* (1) 4 Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">At-risk limits</div>
              <div
                className={cn(
                  "text-2xl font-bold mt-1",
                  atRiskCount > 0 ? "text-amber-500 dark:text-amber-400" : "text-slate-900 dark:text-zinc-100",
                )}
              >
                {atRiskCount}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Active providers</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-1">{trackedCount}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Quota &amp; Wallets</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-1">
                {totalWindows} <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">win</span> /{" "}
                {totalWallets} <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">wallets</span>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Nearest reset</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-1">
                {formatRemainingDuration(nearestResetMs)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* (2) Provider Cards Grid */}
      {filteredSnapshots.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-zinc-900/30 border border-zinc-800/60">
          <p className="text-sm text-zinc-400">No active providers matching the current filter.</p>
          <p className="text-xs text-zinc-500 mt-1">
            Click <strong>Customize</strong> above to toggle providers or configure credentials in Settings.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSnapshots.map((snapshot) => {
            const providerId = snapshot.provider;
            const meta = getProviderMeta(providerId);
            const sortedWindows = sortWindowsForDisplay(snapshot.windows);
            const hasBalance = Boolean(snapshot.balance && snapshot.balance.balances.length > 0);
            const isBalancePriority = isBalanceFirst(snapshot);

            // Case 0: API Key Active (Requires Admin Scope to fetch billing)
            if (
              snapshot.errorCode === "SCOPE_USAGE_READ_REQUIRED" ||
              (!hasBalance && sortedWindows.length === 0)
            ) {
              return (
                <Card
                  key={providerId}
                  className="hover:border-slate-400 dark:hover:border-zinc-700 transition-colors cursor-pointer group"
                  onClick={() => onSelectProvider?.(providerId)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex items-center justify-center shrink-0">
                          <ProviderIcon provider={providerId} size={18} />
                        </div>
                        <CardTitle className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                          {meta.name}
                        </CardTitle>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/60 whitespace-nowrap shrink-0 px-2 py-0.5"
                      >
                        Project API Key
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-1">
                      Inference &amp; Chat Ready · Organization Scoped
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3.5 pt-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
                        Active Key
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-2 py-0.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                      >
                        Connected
                      </Badge>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 text-[11px] space-y-1.5 text-slate-600 dark:text-zinc-400">
                      <div className="flex items-center justify-between">
                        <span>Key Type:</span>
                        <span className="font-mono text-slate-900 dark:text-zinc-200">sk-proj-... (Project Key)</span>
                      </div>
                      <div className="text-[10.5px] text-slate-500 dark:text-zinc-400 leading-relaxed border-t border-slate-200 dark:border-zinc-800/60 pt-1.5">
                        OpenAI restricts Project Keys from reading Billing by default. To display live credit and spend, grant <code className="text-slate-800 dark:text-zinc-200 font-semibold">api.usage.read</code> scope in OpenAI Console or use an Admin Key (<code className="text-slate-800 dark:text-zinc-200 font-semibold">sk-admin-...</code>).
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            // Case 1: Pure Balance Provider (e.g. DeepSeek, OpenAI Platform)
            if (isBalancePriority && hasBalance && snapshot.balance) {
              const allBalances = snapshot.balance.balances;
              // Sort with positive balance first so funded currency is prominent
              const sortedBalances = [...allBalances].sort((a, b) => {
                if (a.totalBalance > 0 && b.totalBalance <= 0) return -1;
                if (b.totalBalance > 0 && a.totalBalance <= 0) return 1;
                return Math.abs(b.totalBalance) - Math.abs(a.totalBalance);
              });
              const primaryBalance = sortedBalances[0];
              const secondaryBalance = sortedBalances.length > 1 ? sortedBalances[1] : null;

              // Check if account has any positive funded amount
              const hasFunded = sortedBalances.some((b) => {
                const threshold = b.currency === "CNY" ? 7 : 1;
                return b.totalBalance > threshold;
              });
              const isLow = !hasFunded;

              return (
                <Card
                  key={providerId}
                  className="hover:border-slate-400 dark:hover:border-zinc-700 transition-colors cursor-pointer group"
                  onClick={() => onSelectProvider?.(providerId)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex items-center justify-center shrink-0">
                          <ProviderIcon provider={providerId} size={18} />
                        </div>
                        <CardTitle className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                          {meta.name}
                        </CardTitle>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/60 whitespace-nowrap shrink-0 px-2 py-0.5"
                      >
                        Prepaid Wallet
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-1">
                      {meta.category === "llm_api"
                        ? "LLM API Key"
                        : meta.category === "aggregator"
                          ? "API Aggregator"
                          : "Cloud Engine"}{" "}
                      · Pay-as-you-go balance
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-1">
                    <div className="flex items-baseline justify-between flex-wrap gap-2">
                      <div className="flex items-baseline space-x-1.5 flex-wrap">
                        {primaryBalance?.usage != null && primaryBalance?.totalBalance === 0 ? (
                          <>
                            <span className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100 font-mono">
                              ${primaryBalance.usage.toFixed(2)}
                            </span>{" "}
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase">
                              USD
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-zinc-500 ml-1">
                              (Nov Spend)
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100 font-mono">
                              {formatCurrencyAmount(
                                primaryBalance?.totalBalance,
                                primaryBalance?.currency,
                              )}
                            </span>{" "}
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase">
                              {primaryBalance?.currency ?? "USD"}
                            </span>
                          </>
                        )}
                        {secondaryBalance && (
                          <div className="flex items-baseline space-x-1 ml-1 text-slate-700 dark:text-zinc-300">
                            <span className="text-slate-400 dark:text-zinc-500 font-medium text-sm">+</span>
                            <span
                              className={cn(
                                "text-xl font-bold font-mono",
                                secondaryBalance.totalBalance < 0
                                  ? "text-slate-500 dark:text-zinc-400"
                                  : "text-slate-900 dark:text-zinc-200",
                              )}
                            >
                              {formatCurrencyAmount(
                                secondaryBalance.totalBalance,
                                secondaryBalance.currency,
                              )}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase">
                              {secondaryBalance.currency}
                            </span>
                          </div>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-2 py-0.5",
                          primaryBalance?.usage != null && primaryBalance?.totalBalance === 0
                            ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                            : isLow
                              ? "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                              : "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                        )}
                      >
                        {primaryBalance?.usage != null && primaryBalance?.totalBalance === 0
                          ? "Admin Verified"
                          : isLow
                            ? "Low Balance"
                            : "Funded"}
                      </Badge>
                    </div>

                    {/* Breakdown of each currency wallet */}
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 text-[11px] space-y-1.5">
                      {sortedBalances.map((b) => (
                        <div key={b.currency} className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                          <span className="font-medium text-slate-800 dark:text-zinc-300">
                            {b.currency === "USD" ? "USD Account:" : "CNY (人民币):"}
                          </span>
                          <div className="flex items-center space-x-2 font-mono">
                            <span className={cn(b.totalBalance < 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-900 dark:text-zinc-100 font-semibold")}>
                              {formatCurrencyAmount(b.totalBalance, b.currency)} {b.currency}
                            </span>
                            {b.toppedUpBalance !== undefined && (
                              <span className="text-[10px] text-slate-500 dark:text-zinc-500">
                                (Cash: {formatCurrencyAmount(b.toppedUpBalance, b.currency)})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            }

            // Case 2: Hybrid Provider (Balance + Quota, like OpenRouter or MiMo)
            if (hasBalance && sortedWindows.length > 0 && snapshot.balance) {
              const primaryBalance = snapshot.balance.balances[0];
              const primaryWindow = sortedWindows[0];
              const remaining = primaryWindow?.remainingPercent ?? 0;

              return (
                <Card
                  key={providerId}
                  className="hover:border-slate-400 dark:hover:border-zinc-700 transition-colors cursor-pointer group"
                  onClick={() => onSelectProvider?.(providerId)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex items-center justify-center shrink-0">
                          <ProviderIcon provider={providerId} size={18} />
                        </div>
                        <CardTitle className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                          {meta.name}
                        </CardTitle>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/60 whitespace-nowrap shrink-0 px-2 py-0.5"
                      >
                        Hybrid Credit
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-1">
                      Balance:{" "}
                      {formatCurrencyAmount(primaryBalance?.totalBalance, primaryBalance?.currency)}{" "}
                      {primaryBalance?.currency ?? "USD"}
                      {primaryWindow ? ` · ${primaryWindow.windowId}` : ""}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-1">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100">
                          {formatCurrencyAmount(
                            primaryBalance?.totalBalance,
                            primaryBalance?.currency,
                          )}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-zinc-400">
                        {remaining.toFixed(0)}% quota left
                      </span>
                    </div>

                    <PacedProgress
                      remainingPercent={remaining}
                      idealRemainingPercent={
                        sortedWindows[0]
                          ? resolveIdealPace(sortedWindows[0], providerId, now)?.idealRemainingPercent ?? null
                          : null
                      }
                      label={`${meta.name} quota bar`}
                      barColor="bg-indigo-500"
                    />
                  </CardContent>
                </Card>
              );
            }

            // Case 3: Subscription Quota Provider (OpenCode Go, Claude, Codex, Antigravity)
            // Multi-Row Support: Render Primary Row (Monthly/Weekly) + Secondary Row (Session/5h)
            const primaryWindow = sortedWindows[0];
            const secondaryWindow = sortedWindows.length > 1 ? sortedWindows[1] : null;
            const thirdWindow = sortedWindows.length > 2 ? sortedWindows[2] : null;

            const primaryReset = primaryWindow?.resetAt ? new Date(primaryWindow.resetAt) : null;
            const primaryRemaining = primaryWindow?.remainingPercent ?? 0;
            const primaryUsed = primaryWindow?.usedPercent ?? 0;

            const secondaryReset = secondaryWindow?.resetAt
              ? new Date(secondaryWindow.resetAt)
              : null;
            const secondaryRemaining = secondaryWindow?.remainingPercent ?? 0;

            return (
              <Card
                key={providerId}
                className="hover:border-slate-400 dark:hover:border-zinc-700 transition-colors cursor-pointer group"
                onClick={() => onSelectProvider?.(providerId)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex items-center justify-center shrink-0">
                        <ProviderIcon provider={providerId} size={18} />
                      </div>
                      <CardTitle className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                        {meta.name}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700/60 whitespace-nowrap shrink-0 px-2 py-0.5"
                    >
                      {meta.defaultPlan}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-1">
                    {primaryWindow ? formatWindowLabel(primaryWindow.windowId) : "Standard Quota"} · Resets in{" "}
                    {primaryReset
                      ? formatRemainingDuration(primaryReset.getTime() - now.getTime())
                      : "unknown"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pt-1">
                  {/* Row 1: Primary Quota Progress */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-2xl font-extrabold text-slate-900 dark:text-zinc-100">
                        {primaryRemaining.toFixed(0)}%{" "}
                        <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">left</span>
                      </span>
                      <span className="text-xs text-slate-500 dark:text-zinc-400">{primaryUsed.toFixed(0)}% used</span>
                    </div>

                    <PacedProgress
                      remainingPercent={primaryRemaining}
                      idealRemainingPercent={
                        primaryWindow
                          ? resolveIdealPace(primaryWindow, providerId, now)?.idealRemainingPercent ?? null
                          : null
                      }
                      label={`${meta.name} primary pace bar`}
                      barColor={
                        providerId === "claude"
                          ? "bg-[#da7756]"
                          : providerId === "codex"
                            ? "bg-[#5c82ff]"
                            : providerId === "opencodego"
                              ? "bg-emerald-400"
                              : "bg-emerald-500"
                      }
                    />
                  </div>

                  {/* Row 2: Secondary Quota Progress (e.g. Weekly quota or 5h Session) */}
                  {secondaryWindow && (
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-800 dark:text-zinc-300 font-medium">
                          {formatWindowLabel(secondaryWindow.windowId)}
                        </span>
                        <div className="flex items-center space-x-1.5 text-slate-500 dark:text-zinc-400 font-mono">
                          <span className="font-semibold text-slate-900 dark:text-zinc-200">
                            {secondaryRemaining.toFixed(0)}% left
                          </span>
                          {secondaryReset && (
                            <span className="text-slate-400 dark:text-zinc-500 text-[10px]">
                              ({formatRemainingDuration(secondaryReset.getTime() - now.getTime())})
                            </span>
                          )}
                        </div>
                      </div>

                      <PacedProgress
                        remainingPercent={secondaryRemaining}
                        idealRemainingPercent={
                          resolveIdealPace(secondaryWindow, providerId, now)?.idealRemainingPercent ?? null
                        }
                        heightClass="h-1.5"
                        showLegend={false}
                        barColor={secondaryRemaining <= 20 ? "bg-amber-400" : "bg-sky-400"}
                      />
                    </div>
                  )}

                  {/* Row 3: Auxiliary badge if 3 windows exist */}
                  {thirdWindow && (
                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 pt-0.5">
                      <span className="truncate">{formatWindowLabel(thirdWindow.windowId)}:</span>
                      <span className="font-mono text-slate-600 dark:text-zinc-400">
                        {thirdWindow.remainingPercent !== null
                          ? `${thirdWindow.remainingPercent.toFixed(0)}% remaining`
                          : "active"}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* (3) Bottom Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {/* Monitored Windows Breakdown */}
        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                Active Quota Windows &amp; Wallets
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                All measured rate limits across local CLI, API &amp; OAuth probes.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 whitespace-nowrap shrink-0 px-2 py-0.5"
            >
              {totalWindows + totalWallets} Active
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2.5">
              {displayedSnapshots.map((s) => {
                const meta = getProviderMeta(s.provider);
                const hasBalance = Boolean(s.balance && s.balance.balances.length > 0);

                return (
                  <div
                    key={s.provider}
                    className="p-3 rounded-lg bg-slate-100 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/70 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-900 dark:text-zinc-200 capitalize flex items-center space-x-1.5">
                        <ProviderIcon provider={s.provider} size={14} />
                        <span>{meta.name}</span>
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {hasBalance
                          ? `${formatCurrencyAmount(s.balance?.balances[0]?.totalBalance, s.balance?.balances[0]?.currency)} balance`
                          : `${s.windows.length} ${s.windows.length === 1 ? "window" : "windows"}`}
                      </span>
                    </div>

                    {s.windows.length > 0 && (
                      <div className="space-y-1.5">
                        {s.windows.map((w) => (
                          <div
                            key={w.windowId}
                            className="flex items-center justify-between text-[11px]"
                          >
                            <span className="text-slate-600 dark:text-zinc-400 font-mono truncate max-w-[160px]">
                              {formatWindowLabel(w.windowId)}
                            </span>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span
                                className={cn(
                                  "font-medium",
                                  (w.remainingPercent ?? 0) <= 20
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-slate-900 dark:text-zinc-200",
                                )}
                              >
                                {w.remainingPercent !== null
                                  ? `${w.remainingPercent.toFixed(0)}% left`
                                  : "unmeasured"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 border-t border-slate-200 dark:border-zinc-800/80 pt-2">
              <span className="text-slate-500 dark:text-zinc-500">Telemetry: Local Process &amp; API Probes</span>
              <button
                type="button"
                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium inline-flex items-center space-x-1 cursor-pointer"
                onClick={onViewHistory}
              >
                <span>Full history</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Real Upcoming Resets Table */}
        <Card className="md:col-span-2 xl:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Upcoming Cycle Resets
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                Dynamic reset schedule sorted chronologically across all verified windows.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900 whitespace-nowrap shrink-0 px-2 py-0.5"
            >
              {upcomingResets.length} Scheduled
            </Badge>
          </CardHeader>
          <CardContent>
            {upcomingResets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-500">
                No active rolling or weekly reset windows detected.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-medium pb-2 text-[11px]">
                      <th className="pb-2">Provider</th>
                      <th className="pb-2">Window Scope</th>
                      <th className="pb-2">Remaining</th>
                      <th className="pb-2">Reset In</th>
                      <th className="pb-2">Exact Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-zinc-800/50">
                    {upcomingResets.map((reset, idx) => {
                      const meta = getProviderMeta(reset.provider);
                      const isAtRisk =
                        reset.remainingPercent !== null && reset.remainingPercent <= 20;

                      return (
                        <tr
                          key={`${reset.provider}-${reset.scope}-${idx}`}
                          className="hover:bg-slate-100/60 dark:hover:bg-zinc-900/40 transition-colors"
                        >
                          <td className="py-2.5 flex items-center space-x-2 font-medium text-slate-900 dark:text-zinc-200">
                            <ProviderIcon provider={reset.provider} size={15} />
                            <span>{meta.name}</span>
                          </td>
                          <td className="py-2.5 text-slate-600 dark:text-zinc-400 font-mono text-[11px]">
                            {formatWindowLabel(reset.scope)}
                          </td>
                          <td className="py-2.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-2 py-0.5 font-mono",
                                isAtRisk
                                  ? "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                                  : "text-slate-800 dark:text-zinc-300 border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900",
                              )}
                            >
                              {reset.remainingPercent !== null
                                ? `${reset.remainingPercent.toFixed(0)}%`
                                : "N/A"}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-slate-900 dark:text-zinc-300 font-medium font-mono text-[11px]">
                            {formatRemainingDuration(reset.resetMs)}
                          </td>
                          <td className="py-2.5 text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                            {reset.resetDate ? formatResetDate(reset.resetDate) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customize Providers Modal */}
      {showCustomizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#111113] border border-slate-200 dark:border-zinc-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 text-slate-900 dark:text-zinc-100">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100 flex items-center space-x-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>Customize Visible Cards</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Choose which AI providers to display on your dashboard overview.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomizeModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
              {PROVIDER_CATALOG.map((p) => {
                const snapshot = snapshots.find((s) => s.provider === p.id);
                const isConfigured = snapshot ? isProviderConfigured(snapshot) : false;
                const isVisible =
                  visibility[p.id] !== undefined ? visibility[p.id] : isConfigured;

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-100 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700/80 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-1.5 rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 shadow-2xs">
                        <ProviderIcon provider={p.id} size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-900 dark:text-zinc-200 flex items-center space-x-1.5">
                          <span>{p.name}</span>
                          {isConfigured && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.2">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-zinc-500 capitalize">
                          {p.category.replace("_", " ")} · {p.defaultPlan}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(p.id)}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                        isVisible ? "bg-emerald-500" : "bg-slate-300 dark:bg-zinc-700",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                          isVisible ? "translate-x-4" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-zinc-800">
              <span className="text-[11px] text-slate-500 dark:text-zinc-500">
                Preferences are persisted automatically to your config.
              </span>
              <button
                type="button"
                onClick={() => setShowCustomizeModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-medium text-slate-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
