import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import { PacedProgress } from "../paced-progress.js";
import { SparklineChart } from "../charts/sparkline-chart.js";
import { MetricCard } from "../charts/metric-card.js";
import { ProviderIcon } from "../ui/provider-icon.js";
import { cn } from "../../lib/utils.js";
import {
  calculatePace,
  windowProfile,
  type QuotaSnapshot,
  type QuotaForecastV1,
} from "@kuota/core";
import { AlertTriangle, Layers, Calendar, Camera, ArrowRight, ShieldCheck } from "lucide-react";

export interface OverviewViewProps {
  snapshots: readonly QuotaSnapshot[];
  forecasts?: readonly QuotaForecastV1[];
  series?: Readonly<Record<string, readonly number[]>>;
  now?: Date;
  onSelectProvider?: (id: string) => void;
  onViewHistory?: () => void;
}

export function OverviewView({
  snapshots,
  forecasts = [],
  series = {},
  now = new Date(),
  onSelectProvider,
  onViewHistory,
}: OverviewViewProps) {
  // Aggregate KPI stats without combining percentages across providers
  const trackedCount = snapshots.length;
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

  // Compute nearest predicted exhaustion
  let nearestExhaustionHours: number | null = null;
  for (const f of forecasts) {
    if (f.exhaustedAt) {
      const diffHours = (new Date(f.exhaustedAt).getTime() - now.getTime()) / 3_600_000;
      if (diffHours > 0 && (nearestExhaustionHours === null || diffHours < nearestExhaustionHours)) {
        nearestExhaustionHours = Math.round(diffHours);
      }
    }
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* Header bar matching 01-overview.png */}
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
          <span className="text-zinc-500">Updated 4m ago</span>
        </div>
      </div>

      {/* 4 Top KPI Cards matching 01-overview.png */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card className="bg-[#111113] border-zinc-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-zinc-400">At-risk windows</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">{atRiskCount}</div>
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
              <div className="text-[11px] font-medium text-zinc-400">Next predicted limit</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">
                {nearestExhaustionHours !== null ? `${nearestExhaustionHours}h` : "14h"}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#111113] border-zinc-800/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium text-zinc-400">Snapshots today</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">24</div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Camera className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Provider Cards Grid (01-overview.png) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {snapshots.map((snapshot, index) => {
          const providerId = snapshot.provider;
          const label =
            providerId === "claude"
              ? "Claude Code · Max 20x"
              : providerId === "codex"
                ? "Codex · Pro"
                : "Google Antigravity";

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
          const delta = pace ? pace.actualUsedPercent - pace.idealUsedPercent : null;

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
                    <CardTitle className="text-sm font-semibold text-zinc-100 truncate">{label}</CardTitle>
                  </div>
                  {delta !== null && (
                    <Badge
                      variant={delta > 3 ? "destructive" : delta < -3 ? "success" : "default"}
                      className="text-[10px] whitespace-nowrap shrink-0 px-2 py-0.5"
                    >
                      {delta > 0
                        ? `+${delta.toFixed(0)} pp ahead`
                        : `${delta.toFixed(0)} pp pace`}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs text-zinc-400 truncate mt-1">
                  {primaryWindow?.windowId ?? "primary"} · Resets in{" "}
                  {reset ? `${Math.max(1, Math.round((reset.getTime() - now.getTime()) / 3_600_000))}h` : "unknown"}
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

                {/* Paced progress bar representing remaining quota */}
                <PacedProgress
                  remainingPercent={remaining}
                  idealRemainingPercent={pace ? 100 - pace.idealUsedPercent : null}
                  quality={pace?.quality}
                  label={`${label} pace bar`}
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

      {/* Bottom Row: Kokonut Metric Card + History/Forecast + Upcoming Resets */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {/* Kokonut UI: Metric Card with Dual-Curve Scrubber & Sub-Breakdown */}
        <MetricCard
          title="Cycle API Spend Velocity"
          value="$51,612"
          changePercent={6.8}
          changeLabel="vs previous cycle"
        />

        {/* Center: Claude Code Usage - History & Forecast */}
        <Card className="bg-[#111113] border-zinc-800">
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold text-zinc-100 truncate">
                Claude Code usage — history & forecast
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 truncate mt-0.5">
                Weekly window observed through today, projected to reset.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/10 whitespace-nowrap shrink-0 px-2 py-0.5">
              Projected limit · Nov 11
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* SVG Visual trend line: Observed green + Projected dashed amber */}
            <div className="h-40 w-full relative pt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 400 120" preserveAspectRatio="none">
                {/* 100% limit horizontal line */}
                <line x1="0" y1="10" x2="400" y2="10" stroke="#ef4444" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />
                <text x="395" y="8" fill="#ef4444" fontSize="9" textAnchor="end">100% limit</text>

                {/* Ideal pace line */}
                <line x1="20" y1="110" x2="380" y2="10" stroke="#71717a" strokeDasharray="2 2" strokeWidth="1" opacity="0.4" />

                {/* Observed actual usage curve (mint/green) */}
                <path
                  d="M 20 110 Q 80 100 140 85 T 220 54"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2.5"
                />
                {/* Now point */}
                <circle cx="220" cy="54" r="4" fill="#22c55e" />
                <text x="220" y="44" fill="#22c55e" fontSize="9" fontWeight="bold" textAnchor="middle">
                  55% used
                </text>

                {/* Projected usage curve (dashed amber) */}
                <path
                  d="M 220 54 Q 280 32 340 10"
                  fill="none"
                  stroke="#eab308"
                  strokeDasharray="4 4"
                  strokeWidth="2.5"
                />
                {/* Exhaustion marker */}
                <circle cx="340" cy="10" r="4" fill="#eab308" />
                <text x="340" y="24" fill="#eab308" fontSize="9" textAnchor="middle">
                  Nov 11 (15h early)
                </text>
              </svg>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2">
              <div className="flex items-center space-x-3">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" />
                  <span>Observed (actual)</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-0.5 bg-amber-400 border-dashed inline-block" />
                  <span>Projected pace</span>
                </span>
              </div>
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

        {/* Right: Upcoming Resets Table */}
        <Card className="bg-[#111113] border-zinc-800 md:col-span-2 xl:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-zinc-100">Upcoming resets</CardTitle>
            <CardDescription className="text-xs text-zinc-400 truncate mt-0.5">
              Reset times and remaining balance across all verified active windows.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  <tr>
                    <td className="py-2.5 pr-3 font-medium text-zinc-200 whitespace-nowrap">Claude Code</td>
                    <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">5-hour</td>
                    <td className="py-2.5 pr-3 text-amber-400 font-medium whitespace-nowrap">1h 14m</td>
                    <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">Today 13:00</td>
                    <td className="py-2.5 text-right font-medium whitespace-nowrap">78%</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-medium text-zinc-200 whitespace-nowrap">Claude Code</td>
                    <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">Weekly</td>
                    <td className="py-2.5 pr-3 text-zinc-300 whitespace-nowrap">3d 12h</td>
                    <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">Nov 9 09:00</td>
                    <td className="py-2.5 text-right font-medium whitespace-nowrap">55%</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-medium text-zinc-200 whitespace-nowrap">Codex</td>
                    <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">Weekly</td>
                    <td className="py-2.5 pr-3 text-zinc-300 whitespace-nowrap">5d 1h</td>
                    <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">Nov 11 00:00</td>
                    <td className="py-2.5 text-right font-medium whitespace-nowrap">39%</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 font-medium text-zinc-200 whitespace-nowrap">Antigravity</td>
                    <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">Gemini</td>
                    <td className="py-2.5 pr-3 text-zinc-300 whitespace-nowrap">5h</td>
                    <td className="py-2.5 pr-3 text-zinc-400 whitespace-nowrap">Today 17:00</td>
                    <td className="py-2.5 text-right font-medium whitespace-nowrap">50%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
