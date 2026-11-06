import * as React from "react";
import { cn } from "../lib/utils.js";

export interface PacedProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Remaining quota percent (0–100%). Primary visual metric: colored fill represents remaining balance. */
  remainingPercent?: number | null;
  /** Ideal remaining pace percent (0–100%). White pace tick sits at this position. */
  idealRemainingPercent?: number | null;
  /** Legacy: used quota percentage. If remainingPercent is omitted, remaining = 100 - usedPercent. */
  usedPercent?: number | null;
  /** Legacy: ideal used percentage. If idealRemainingPercent is omitted, idealRemaining = 100 - idealUsedPercent. */
  idealUsedPercent?: number | null;
  quality?: "exact" | "inferred";
  label?: string;
  className?: string;
  heightClass?: string;
  /** Custom fill color class (e.g. "bg-[#da7756]" for Claude coral, "bg-[#5c82ff]" for Codex blue, "bg-emerald-500" for Antigravity). */
  barColor?: string;
  /** Show legend underneath the bar. Defaults to true. */
  showLegend?: boolean;
}

export function PacedProgress({
  remainingPercent,
  idealRemainingPercent,
  usedPercent,
  idealUsedPercent,
  quality = "inferred",
  label,
  className,
  heightClass = "h-2.5",
  barColor: customBarColor,
  showLegend = true,
  ...props
}: PacedProgressProps) {
  // Resolve remaining percentage (primary)
  const remaining =
    remainingPercent !== undefined && remainingPercent !== null
      ? Math.max(0, Math.min(100, remainingPercent))
      : usedPercent !== undefined && usedPercent !== null
        ? Math.max(0, Math.min(100, 100 - usedPercent))
        : null;

  // Resolve ideal remaining pace percentage (primary)
  const idealRemaining =
    idealRemainingPercent !== undefined && idealRemainingPercent !== null
      ? Math.max(0, Math.min(100, idealRemainingPercent))
      : idealUsedPercent !== undefined && idealUsedPercent !== null
        ? Math.max(0, Math.min(100, 100 - idealUsedPercent))
        : null;

  // Determine fill color based on remaining balance if no custom brand color provided
  const fillClass =
    customBarColor ??
    (remaining === null
      ? "bg-zinc-700"
      : remaining <= 15
        ? "bg-red-500"
        : remaining <= 35
          ? "bg-amber-500"
          : "bg-emerald-500");

  // Pace comparison: if remaining < idealRemaining, quota is draining faster than linear pace
  const paceDelta =
    remaining !== null && idealRemaining !== null ? remaining - idealRemaining : null;

  return (
    <div className={cn("flex flex-col space-y-1.5 w-full", className)} {...props}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-zinc-900/90 border border-zinc-800/80 shadow-inner",
          heightClass,
        )}
        role="progressbar"
        aria-valuenow={remaining ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Quota remaining progress"}
        aria-description={
          idealRemaining !== null
            ? `Ideal time-based pace is ${idealRemaining.toFixed(1)}% remaining (${quality}). Actual remaining is ${remaining ?? 0}%.`
            : "Window cadence is unproven or rolling; no linear ideal marker."
        }
      >
        {/* Measured Remaining Balance Fill */}
        {remaining !== null && (
          <div
            className={cn("h-full transition-all duration-300 rounded-full", fillClass)}
            style={{ width: `${remaining}%` }}
          />
        )}

        {/* White Ideal Pace Marker: Exactly one marker per window when known */}
        {idealRemaining !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_5px_rgba(255,255,255,0.95)] z-10"
            style={{ left: `${idealRemaining}%` }}
            title={`Ideal remaining pace at this point in cycle: ${idealRemaining.toFixed(1)}% (${quality})`}
          />
        )}
      </div>

      {/* Legend & Pace Delta */}
      {showLegend && (
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <div>
            {remaining !== null ? (
              <span className="font-semibold text-zinc-100">{remaining.toFixed(0)}% left</span>
            ) : (
              <span className="text-zinc-500">Unmeasured</span>
            )}
            {idealRemaining !== null && (
              <span className="ml-2 text-zinc-400">
                · ideal <span className="text-white font-medium">{idealRemaining.toFixed(0)}% left</span> ({quality})
              </span>
            )}
          </div>

          {paceDelta !== null && (
            <div
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                paceDelta < -5
                  ? "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                  : paceDelta > 5
                    ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                    : "bg-zinc-800 text-zinc-300",
              )}
            >
              {paceDelta < -5
                ? `${Math.abs(paceDelta).toFixed(0)}% ahead of pace`
                : paceDelta > 5
                  ? `${paceDelta.toFixed(0)}% under pace`
                  : "On pace"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
