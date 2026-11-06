import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { PacedProgress } from "../paced-progress.js";
import { ProviderIcon } from "../ui/provider-icon.js";
import { cn } from "../../lib/utils.js";
import {
  calculatePace,
  windowProfile,
  type QuotaSnapshot,
  type QuotaForecastV1,
} from "@kuota/core";
import { AlertTriangle, Layers, Calendar, Clock, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";

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
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
  // Aggregate real stats directly from snapshots
  const trackedCount = snapshots.length;
  const totalWindows = snapshots.reduce((acc, s) => acc + s.windows.length, 0);

  // Collect real window reset countdowns
  const allResets = snapshots
    .flatMap((s) => s.windows)
    .map((w) => (w.resetAt ? new Date(w.resetAt).getTime() - now.getTime() : null))
    .filter((ms): ms is number => ms !== null && ms > 0);
  const nearestResetMs = allResets.length > 0 ? Math.min(...allResets) : null;

  // Real at-risk windows: <= 20% remaining balance or exhausted forecast
  const atRiskCount = snapshots.reduce((acc, s) => {
    return (
      acc +
      s.windows.filter((w) => {
        if (w.remainingPercent !== null && w.remainingPercent <= 20) return true;
        const f = forecasts.find((fc) => fc.provider === s.provider && fc.windowId === w.windowId);
        return f?.exhaustedAt !== null && f?.exhaustedAt !== undefined;
      }).length
    );
  }, 0);

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
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-zinc-800">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold tracking-tight text-zinc-100">KUOTA</h2>
            <Badge variant="outline" className="text-[11px] text-zinc-400 bg-zinc-900 border-zinc-700">
              Today
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Independent AI quota pacing and limit forecasting across verified local tools.
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs text-zinc-400">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium">Local device connected</span>
          </div>
          <span className="text-zinc-500">Live Telemetry</span>
        </div>
      </div>

      {/* 4 Top KPI Cards with 100% Real Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="bg-[#111113] border-zinc-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-zinc-400">At-risk windows</div>
              <div className={cn("text-2xl font-bold mt-1", atRiskCount > 0 ? "text-amber-400" : "text-zinc-100")}>
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
              <div className="text-[11px] font-medium text-zinc-400">Tracked providers</div>
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
              <div className="text-[11px] font-medium text-zinc-400">Active windows</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">{totalWindows}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111113] border-zinc-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-zinc-400">Next reset in</div>
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

      {/* Main Provider Cards Grid (2 cols on md, 3 cols on xl) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {snapshots.map((snapshot, index) => {
          const providerId = snapshot.provider;
          const providerTitle =
            providerId === "claude"
              ? "Claude Code"
              : providerId === "codex"
                ? "Codex"
                : "Google Antigravity";

          const planBadge =
            providerId === "claude"
              ? "Max 20x"
              : providerId === "codex"
                ? "Pro"
                : "Gemini";

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
              className={cn(
                "bg-[#111113] border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer group",
                index === 2 ? "md:col-span-2 xl:col-span-1" : "",
              )}
              onClick={() => onSelectProvider?.(providerId)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 shadow-sm flex items-center justify-center shrink-0">
                      <ProviderIcon provider={providerId} size={18} />
                    </div>
                    <CardTitle className="text-sm font-semibold text-zinc-100 truncate">
                      {providerTitle}
                    </CardTitle>
                  </div>
                  {/* Plan tier badge - no duplicate pace delta badge here */}
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60 whitespace-nowrap shrink-0 px-2 py-0.5"
                  >
                    {planBadge}
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
                    {remaining.toFixed(0)}% <span className="text-sm font-normal text-zinc-400">left</span>
                  </span>
                  <span className="text-xs text-zinc-400">
                    {used.toFixed(0)}% used
                  </span>
                </div>

                {/* Paced progress bar representing remaining quota - pace delta with % rendered cleanly here */}
                <PacedProgress
                  remainingPercent={remaining}
                  idealRemainingPercent={pace ? 100 - pace.idealUsedPercent : null}
                  quality={pace?.quality}
                  label={`${providerTitle} pace bar`}
                  barColor={
                    providerId === "claude"
                      ? "bg-[#da7756]"
                      : providerId === "codex"
                        ? "bg-[#5c82ff]"
                        : "bg-emerald-500"
                  }
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bottom Section: Real Monitored Windows + Real Upcoming Resets Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {/* Monitored Windows Breakdown (100% Real Live Quota Telemetry) */}
        <Card className="bg-[#111113] border-zinc-800 md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-zinc-100 truncate">
                Active Quota Windows
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 truncate mt-0.5">
                All measured rate limits across local CLI & OAuth probes.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10 whitespace-nowrap shrink-0 px-2 py-0.5">
              {totalWindows} Windows Active
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2.5">
              {snapshots.map((s) => (
                <div key={s.provider} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-200 capitalize flex items-center space-x-1.5">
                      <ProviderIcon provider={s.provider} size={14} />
                      <span>{s.provider === "antigravity" ? "Google Antigravity" : s.provider}</span>
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {s.windows.length} {s.windows.length === 1 ? "window" : "windows"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {s.windows.map((w) => (
                      <div key={w.windowId} className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 font-mono truncate max-w-[160px]">{w.windowId}</span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className={cn(
                            "font-medium",
                            (w.remainingPercent ?? 0) <= 20 ? "text-amber-400" : "text-zinc-200"
                          )}>
                            {w.remainingPercent !== null ? `${w.remainingPercent.toFixed(0)}% left` : "unmeasured"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2">
              <span className="text-zinc-500">Telemetry: Local Process Probes</span>
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
              <CardTitle className="text-sm font-semibold text-zinc-100">Upcoming Resets</CardTitle>
              <CardDescription className="text-xs text-zinc-400 truncate mt-0.5">
                Dynamic reset schedule sorted chronologically across all verified windows.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700 bg-zinc-900 whitespace-nowrap shrink-0 px-2 py-0.5">
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
                    {upcomingResets.map((row, i) => (
                      <tr key={`${row.provider}-${row.scope}-${i}`} className="hover:bg-zinc-900/30 transition-colors">
                        <td className="py-2.5 pr-3 font-medium text-zinc-200 whitespace-nowrap flex items-center space-x-1.5">
                          <ProviderIcon provider={row.provider} size={14} />
                          <span className="capitalize">{row.provider}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap font-mono text-[11px]">{row.scope}</td>
                        <td className="py-2.5 pr-3 whitespace-nowrap font-medium">
                          <span className={cn(
                            (row.resetMs ?? 0) < 6 * 3_600_000 ? "text-amber-400 font-semibold" : "text-zinc-200"
                          )}>
                            {formatRemainingDuration(row.resetMs)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">
                          {row.resetDate ? formatResetDate(row.resetDate) : "--"}
                        </td>
                        <td className="py-2.5 text-right font-medium whitespace-nowrap">
                          {row.usedPercent !== null ? (
                            <span className={cn(
                              row.usedPercent >= 80 ? "text-red-400" : row.usedPercent >= 50 ? "text-amber-400" : "text-emerald-400"
                            )}>
                              {row.usedPercent.toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-zinc-500">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
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
