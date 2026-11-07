import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { PacedProgress } from "../paced-progress.js";
import { ProviderIcon } from "../ui/provider-icon.js";
import { cn } from "../../lib/utils.js";
import {
  calculatePace,
  windowProfile,
  getProviderMeta,
  formatCurrencyAmount,
  isBalanceFirst,
  type QuotaSnapshot,
  type QuotaForecastV1,
} from "@kuota/core";
import { AlertTriangle, Layers, Clock, ArrowRight, Wallet } from "lucide-react";

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

export function OverviewView({
  snapshots,
  forecasts = [],
  series = {},
  now = new Date(),
  onSelectProvider,
  onViewHistory,
}: OverviewViewProps) {
  let filter: "all" | "subscription" | "balance" = "all";
  let setFilter: (f: "all" | "subscription" | "balance") => void = () => {};
  try {
    const [f, sf] = React.useState<"all" | "subscription" | "balance">("all");
    filter = f;
    setFilter = sf;
  } catch {
    filter = "all";
  }

  // Aggregate real stats directly from snapshots
  const trackedCount = snapshots.length;
  const totalWindows = snapshots.reduce((acc, s) => acc + s.windows.length, 0);
  const totalWallets = snapshots.reduce((acc, s) => acc + (s.balance?.balances.length ? 1 : 0), 0);

  // Collect real window reset countdowns
  const allResets = snapshots
    .flatMap((s) => s.windows)
    .map((w) => (w.resetAt ? new Date(w.resetAt).getTime() - now.getTime() : null))
    .filter((ms): ms is number => ms !== null && ms > 0);
  const nearestResetMs = allResets.length > 0 ? Math.min(...allResets) : null;

  // Real at-risk count
  const atRiskCount = snapshots.reduce((acc, s) => {
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
  const filteredSnapshots = snapshots.filter((s) => {
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
  const upcomingResets = snapshots
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">KUOTA</h2>
            <Badge
              variant="outline"
              className="text-[11px] text-zinc-400 bg-zinc-900 border-zinc-700"
            >
              Multi-Provider Telemetry
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Unified subscription quota pacing, prepaid wallet balances, and limit forecasting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Pills */}
          <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors",
                filter === "all"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
              onClick={() => setFilter("all")}
            >
              All ({snapshots.length})
            </button>
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors",
                filter === "subscription"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
              onClick={() => setFilter("subscription")}
            >
              Quota
            </button>
            <button
              type="button"
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors",
                filter === "balance"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
              onClick={() => setFilter("balance")}
            >
              Wallets
            </button>
          </div>

          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium">{trackedCount} Active</span>
          </div>
        </div>
      </div>

      {/* (1) 4 Top KPI Cards with 100% Real Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="bg-[#111113] border-zinc-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-zinc-400">At-risk limits</div>
              <div
                className={cn(
                  "text-2xl font-bold mt-1",
                  atRiskCount > 0 ? "text-amber-400" : "text-zinc-100",
                )}
              >
                {atRiskCount}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111113] border-zinc-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-zinc-400">Active providers</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">{trackedCount}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111113] border-zinc-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-zinc-400">Quota &amp; Wallets</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">
                {totalWindows} <span className="text-xs font-normal text-zinc-400">win</span> /{" "}
                {totalWallets} <span className="text-xs font-normal text-zinc-400">wallets</span>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Wallet className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111113] border-zinc-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-zinc-400">Next cycle reset</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">
                {formatRemainingDuration(nearestResetMs)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* (2) Main Provider Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredSnapshots.map((snapshot) => {
          const providerId = snapshot.provider;
          const meta = getProviderMeta(providerId);
          const hasBalance = Boolean(snapshot.balance && snapshot.balance.balances.length > 0);
          const isBalanceOnly = hasBalance && snapshot.windows.length === 0;

          // Case 1: Balance-Only or Balance-First Provider
          if (isBalanceOnly && snapshot.balance) {
            const primaryBalance = snapshot.balance.balances[0];
            const secondaryBalance = snapshot.balance.balances[1];
            const isLow =
              primaryBalance &&
              primaryBalance.totalBalance <= (primaryBalance.currency === "CNY" ? 7 : 1);

            return (
              <Card
                key={providerId}
                className="bg-[#111113] border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer group"
                onClick={() => onSelectProvider?.(providerId)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 shadow-sm flex items-center justify-center shrink-0">
                        <ProviderIcon provider={providerId} size={18} />
                      </div>
                      <CardTitle className="text-sm font-semibold text-zinc-100 truncate">
                        {meta.name}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60 whitespace-nowrap shrink-0 px-2 py-0.5"
                    >
                      Prepaid Wallet
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-zinc-400 truncate mt-1">
                    {meta.category === "llm_api"
                      ? "LLM API Key"
                      : meta.category === "aggregator"
                        ? "API Aggregator"
                        : "Cloud Engine"}{" "}
                    · Pay-as-you-go balance
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-1">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-extrabold text-zinc-100">
                        {formatCurrencyAmount(
                          primaryBalance?.totalBalance,
                          primaryBalance?.currency,
                        )}
                      </span>{" "}
                      <span className="text-xs font-semibold text-zinc-400 uppercase">
                        {primaryBalance?.currency ?? "USD"}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-2 py-0.5",
                        isLow
                          ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                          : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                      )}
                    >
                      {isLow ? "Low Balance" : "Funded"}
                    </Badge>
                  </div>

                  {/* Cash vs Granted breakdown */}
                  <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Topped-up Cash:</span>
                      <span className="font-mono text-zinc-200">
                        {formatCurrencyAmount(
                          primaryBalance?.toppedUpBalance,
                          primaryBalance?.currency,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-400">
                      <span>Granted Credits:</span>
                      <span className="font-mono text-zinc-200">
                        {formatCurrencyAmount(
                          primaryBalance?.grantedBalance,
                          primaryBalance?.currency,
                        )}
                      </span>
                    </div>
                    {secondaryBalance && (
                      <div className="flex items-center justify-between text-zinc-400 border-t border-zinc-800/60 pt-1 mt-1">
                        <span>Secondary ({secondaryBalance.currency}):</span>
                        <span className="font-mono text-zinc-200">
                          {formatCurrencyAmount(
                            secondaryBalance.totalBalance,
                            secondaryBalance.currency,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          }

          // Case 2: Hybrid Provider (like OpenRouter or MiMo)
          if (hasBalance && snapshot.windows.length > 0 && snapshot.balance) {
            const primaryBalance = snapshot.balance.balances[0];
            const primaryWindow = snapshot.windows[0];
            const remaining = primaryWindow?.remainingPercent ?? 0;

            return (
              <Card
                key={providerId}
                className="bg-[#111113] border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer group"
                onClick={() => onSelectProvider?.(providerId)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 shadow-sm flex items-center justify-center shrink-0">
                        <ProviderIcon provider={providerId} size={18} />
                      </div>
                      <CardTitle className="text-sm font-semibold text-zinc-100 truncate">
                        {meta.name}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60 whitespace-nowrap shrink-0 px-2 py-0.5"
                    >
                      Hybrid Credit
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-zinc-400 truncate mt-1">
                    Balance:{" "}
                    {formatCurrencyAmount(primaryBalance?.totalBalance, primaryBalance?.currency)}{" "}
                    {primaryBalance?.currency ?? "USD"}{primaryWindow ? ` · ${primaryWindow.windowId}` : ""}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-1">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-3xl font-extrabold text-zinc-100">
                        {formatCurrencyAmount(
                          primaryBalance?.totalBalance,
                          primaryBalance?.currency,
                        )}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {remaining.toFixed(0)}% quota left
                    </span>
                  </div>

                  {/* Utilization Progress Bar */}
                  <PacedProgress
                    remainingPercent={remaining}
                    idealRemainingPercent={null}
                    label={`${meta.name} quota bar`}
                    barColor="bg-indigo-500"
                  />
                </CardContent>
              </Card>
            );
          }

          // Case 3: Subscription Quota Provider
          const primaryWindow = snapshot.windows[0];
          const profile = primaryWindow
            ? windowProfile(snapshot.provider, primaryWindow.windowId, primaryWindow.resetAt, now)
            : null;
          const reset = primaryWindow?.resetAt ? new Date(primaryWindow.resetAt) : null;
          const start =
            reset && profile?.durationMs !== null && profile?.durationMs !== undefined
              ? new Date(reset.getTime() - profile.durationMs)
              : null;

          const pace =
            primaryWindow && profile
              ? calculatePace({
                  now,
                  startAt: start,
                  resetAt: reset,
                  usedPercent: primaryWindow.usedPercent,
                  semantics: profile.semantics,
                  startSource: start ? "inferred" : "unknown",
                })
              : null;

          const remaining = primaryWindow?.remainingPercent ?? 0;
          const used = primaryWindow?.usedPercent ?? 0;

          return (
            <Card
              key={providerId}
              className="bg-[#111113] border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer group"
              onClick={() => onSelectProvider?.(providerId)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 shadow-sm flex items-center justify-center shrink-0">
                      <ProviderIcon provider={providerId} size={18} />
                    </div>
                    <CardTitle className="text-sm font-semibold text-zinc-100 truncate">
                      {meta.name}
                    </CardTitle>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60 whitespace-nowrap shrink-0 px-2 py-0.5"
                  >
                    {meta.defaultPlan}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-zinc-400 truncate mt-1">
                  {primaryWindow?.windowId ?? "primary"} · Resets in{" "}
                  {reset ? formatRemainingDuration(reset.getTime() - now.getTime()) : "unknown"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-zinc-100">
                    {remaining.toFixed(0)}%{" "}
                    <span className="text-sm font-normal text-zinc-400">left</span>
                  </span>
                  <span className="text-xs text-zinc-400">{used.toFixed(0)}% used</span>
                </div>

                {/* Paced progress bar representing remaining quota */}
                <PacedProgress
                  remainingPercent={remaining}
                  idealRemainingPercent={pace ? 100 - pace.idealUsedPercent : null}
                  quality={pace?.quality}
                  label={`${meta.name} pace bar`}
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
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* (3) Bottom Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {/* Monitored Windows Breakdown */}
        <Card className="bg-[#111113] border-zinc-800 md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-zinc-100 truncate">
                Active Quota Windows &amp; Wallets
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 truncate mt-0.5">
                All measured rate limits across local CLI, API &amp; OAuth probes.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10 whitespace-nowrap shrink-0 px-2 py-0.5"
            >
              {totalWindows + totalWallets} Active
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2.5">
              {snapshots.map((s) => {
                const meta = getProviderMeta(s.provider);
                const hasBalance = Boolean(s.balance && s.balance.balances.length > 0);

                return (
                  <div
                    key={s.provider}
                    className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/70 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-200 capitalize flex items-center space-x-1.5">
                        <ProviderIcon provider={s.provider} size={14} />
                        <span>{meta.name}</span>
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {hasBalance
                          ? `${formatCurrencyAmount(s.balance?.balances[0]?.totalBalance, s.balance?.balances[0]?.currency)} balance`
                          : `${s.windows.length} ${s.windows.length === 1 ? "window" : "windows"}`}
                      </span>
                    </div>

                    {/* Window details */}
                    {s.windows.length > 0 && (
                      <div className="space-y-1.5">
                        {s.windows.map((w) => (
                          <div
                            key={w.windowId}
                            className="flex items-center justify-between text-[11px]"
                          >
                            <span className="text-zinc-400 font-mono truncate max-w-[160px]">
                              {w.windowId}
                            </span>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span
                                className={cn(
                                  "font-medium",
                                  (w.remainingPercent ?? 0) <= 20
                                    ? "text-amber-400"
                                    : "text-zinc-200",
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

            <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2">
              <span className="text-zinc-500">Telemetry: Local Process &amp; API Probes</span>
              <button
                type="button"
                className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center space-x-1"
                onClick={onViewHistory}
              >
                <span>Full history</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Real Upcoming Resets Table */}
        <Card className="bg-[#111113] border-zinc-800 md:col-span-2 xl:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-100">
                Upcoming Cycle Resets
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 truncate mt-0.5">
                Dynamic reset schedule sorted chronologically across all verified windows.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] text-zinc-400 border-zinc-700 bg-zinc-900 whitespace-nowrap shrink-0 px-2 py-0.5"
            >
              {upcomingResets.length} Scheduled
            </Badge>
          </CardHeader>
          <CardContent>
            {upcomingResets.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No active rolling or weekly reset windows detected.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-medium pb-2 text-[11px]">
                      <th className="py-2 pr-3 whitespace-nowrap font-medium">Provider</th>
                      <th className="py-2 pr-3 whitespace-nowrap font-medium">Scope</th>
                      <th className="py-2 pr-3 whitespace-nowrap font-medium">Resets in</th>
                      <th className="py-2 pr-3 whitespace-nowrap font-medium">Reset at</th>
                      <th className="py-2 text-right whitespace-nowrap font-medium">Current use</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    {upcomingResets.map((row, i) => {
                      const meta = getProviderMeta(row.provider);
                      return (
                        <tr
                          key={`${row.provider}-${row.scope}-${i}`}
                          className="hover:bg-zinc-900/30 transition-colors"
                        >
                          <td className="py-2.5 pr-3 font-medium text-zinc-200 whitespace-nowrap flex items-center space-x-1.5">
                            <ProviderIcon provider={row.provider} size={14} />
                            <span>{meta.shortName}</span>
                          </td>
                          <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap font-mono text-[11px]">
                            {row.scope}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap font-medium">
                            <span
                              className={cn(
                                (row.resetMs ?? 0) < 6 * 3_600_000
                                  ? "text-amber-400 font-semibold"
                                  : "text-zinc-200",
                              )}
                            >
                              {formatRemainingDuration(row.resetMs)}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">
                            {row.resetDate ? formatResetDate(row.resetDate) : "--"}
                          </td>
                          <td className="py-2.5 text-right font-medium whitespace-nowrap">
                            {row.usedPercent !== null ? (
                              <span
                                className={cn(
                                  row.usedPercent >= 80
                                    ? "text-red-400"
                                    : row.usedPercent >= 50
                                      ? "text-amber-400"
                                      : "text-emerald-400",
                                )}
                              >
                                {row.usedPercent.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-zinc-500">--</span>
                            )}
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
    </div>
  );
}
