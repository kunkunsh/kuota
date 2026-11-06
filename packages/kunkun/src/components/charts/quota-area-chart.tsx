import * as React from "react";
import { cn } from "../../lib/utils.js";
import type { QuotaForecastV1, QuotaHistoryEventV1 } from "@kuota/core";

export interface QuotaAreaChartProps {
  observations: readonly QuotaHistoryEventV1[];
  forecast?: QuotaForecastV1;
  className?: string;
  height?: number;
}

export function QuotaAreaChart({
  observations,
  forecast,
  className,
  height = 180,
}: QuotaAreaChartProps) {
  const measurable = observations
    .filter((o) => o.usedPercent !== null && Number.isFinite(o.usedPercent))
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));

  if (measurable.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 text-xs text-zinc-500",
          className,
        )}
        style={{ height }}
      >
        No historical points collected yet · run `kuota collect --once`
      </div>
    );
  }

  const width = 600;
  const padding = { top: 20, right: 30, bottom: 25, left: 35 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const tMin = Date.parse(measurable[0]!.observedAt);
  const tMaxObs = Date.parse(measurable[measurable.length - 1]!.observedAt);
  const tForecastEnd = forecast?.exhaustedAt
    ? Math.max(tMaxObs, Date.parse(forecast.exhaustedAt))
    : tMaxObs + 24 * 3600 * 1000;
  const tSpan = Math.max(1, tForecastEnd - tMin);

  const getX = (timeIso: string) => {
    const t = Date.parse(timeIso);
    return padding.left + Math.max(0, Math.min(chartW, ((t - tMin) / tSpan) * chartW));
  };

  const getY = (percent: number) => {
    return padding.top + chartH - (Math.max(0, Math.min(100, percent)) / 100) * chartH;
  };

  // Build points path for observed history
  const observedPoints = measurable.map((m) => `${getX(m.observedAt)},${getY(m.usedPercent!)}`);
  const observedPath = `M ${observedPoints.join(" L ")}`;

  // Area under observed curve
  const firstX = getX(measurable[0]!.observedAt);
  const lastX = getX(measurable[measurable.length - 1]!.observedAt);
  const baselineY = getY(0);
  const areaPath = `${observedPath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z`;

  // Forecast projected line
  let forecastPath: string | null = null;
  if (
    forecast &&
    forecast.slopePercentPerHour !== null &&
    forecast.slopePercentPerHour > 0 &&
    forecast.exhaustedAt
  ) {
    const startPoint = `${lastX},${getY(measurable[measurable.length - 1]!.usedPercent!)}`;
    const endPoint = `${getX(forecast.exhaustedAt)},${getY(100)}`;
    forecastPath = `M ${startPoint} L ${endPoint}`;
  }

  return (
    <div className={cn("flex flex-col space-y-2 w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
      >
        <defs>
          <linearGradient id="observedArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* 100% Limit Reference Line */}
        <line
          x1={padding.left}
          y1={getY(100)}
          x2={width - padding.right}
          y2={getY(100)}
          stroke="#ef4444"
          strokeDasharray="4 4"
          strokeWidth="1"
          opacity="0.6"
        />
        <text
          x={width - padding.right + 4}
          y={getY(100) + 3}
          fill="#ef4444"
          fontSize="9"
          fontFamily="sans-serif"
        >
          100%
        </text>

        {/* 50% Reference Line */}
        <line
          x1={padding.left}
          y1={getY(50)}
          x2={width - padding.right}
          y2={getY(50)}
          stroke="#3f3f46"
          strokeDasharray="2 4"
          strokeWidth="1"
          opacity="0.4"
        />

        {/* Y-Axis Labels */}
        <text x={padding.left - 6} y={getY(100) + 3} fill="#71717a" fontSize="9" textAnchor="end">
          100%
        </text>
        <text x={padding.left - 6} y={getY(50) + 3} fill="#71717a" fontSize="9" textAnchor="end">
          50%
        </text>
        <text x={padding.left - 6} y={getY(0) + 3} fill="#71717a" fontSize="9" textAnchor="end">
          0%
        </text>

        {/* Area fill under curve */}
        <path d={areaPath} fill="url(#observedArea)" />

        {/* Solid Observed Quota Curve */}
        <path
          d={observedPath}
          fill="none"
          stroke="#22c55e"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dashed Forecast Line */}
        {forecastPath && (
          <path
            d={forecastPath}
            fill="none"
            stroke="#eab308"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        )}

        {/* Sample point dots */}
        {measurable.map((m, idx) => (
          <circle
            key={idx}
            cx={getX(m.observedAt)}
            cy={getY(m.usedPercent!)}
            r="3"
            fill="#22c55e"
            stroke="#111113"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      {/* Legend & Confidence */}
      <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 pt-1 border-t border-zinc-800/60">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1.5">
            <span className="inline-block w-2.5 h-0.5 bg-emerald-500 rounded" />
            <span>Observed usage</span>
          </span>
          {forecastPath && (
            <span className="flex items-center space-x-1.5">
              <span className="inline-block w-2.5 h-0.5 border-t border-dashed border-amber-500" />
              <span>Projected trend</span>
            </span>
          )}
        </div>

        {forecast && (
          <div className="text-[10px]">
            Confidence:{" "}
            <span
              className={cn(
                "font-semibold uppercase tracking-wider",
                forecast.quality === "high"
                  ? "text-emerald-400"
                  : forecast.quality === "medium"
                    ? "text-blue-400"
                    : forecast.quality === "low"
                      ? "text-amber-400"
                      : "text-zinc-500",
              )}
            >
              {forecast.quality}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
