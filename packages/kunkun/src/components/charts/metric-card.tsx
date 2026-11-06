import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface MetricCardSegment {
  label: string;
  value: string;
  sharePercent: number;
  color?: string; // e.g. "bg-white", "bg-zinc-400", "bg-zinc-600"
}

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  value?: string;
  changePercent?: number;
  changeLabel?: string;
  periods?: readonly string[];
  activePeriod?: string;
  onPeriodChange?: (period: string) => void;
  segments?: readonly MetricCardSegment[];
  className?: string;
}

export function MetricCard({
  title = "API Spend Velocity",
  value = "$51,612",
  changePercent = 6.8,
  changeLabel = "vs previous 30 days",
  periods = ["7D", "30D", "90D"],
  activePeriod = "30D",
  onPeriodChange,
  segments = [
    { label: "Claude Code (Sonnet 3.7)", value: "$32,060", sharePercent: 62, color: "bg-[#da7756]" },
    { label: "Codex (GPT-4o Pro)", value: "$15,002", sharePercent: 29, color: "bg-[#5c82ff]" },
    { label: "Antigravity (Gemini 2.5)", value: "$4,550", sharePercent: 9, color: "bg-emerald-400" },
  ],
  className,
  ...props
}: MetricCardProps) {
  const [currentPeriod, setCurrentPeriod] = React.useState(activePeriod);
  const [scrubberActive, setScrubberActive] = React.useState(false);

  // SVG dimensions for sparkline
  const width = 360;
  const height = 100;

  // Dual line curves (solid white current, dashed gray previous)
  const currentPath =
    "M 0,70 Q 20,60 40,40 T 80,75 T 120,45 T 160,80 T 200,60 T 240,40 T 280,70 T 320,45 T 360,50";
  const previousPath =
    "M 0,80 Q 20,75 40,70 T 80,60 T 120,75 T 160,65 T 200,75 T 240,60 T 280,65 T 320,70 T 360,65";

  return (
    <div
      className={cn(
        "rounded-3xl bg-[#0c0c0e] border border-zinc-800/80 p-6 shadow-2xl space-y-4 select-none max-w-md",
        className,
      )}
      {...props}
    >
      {/* Top Header Row with Range Switcher */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{title}</span>

        {/* 7D | 30D | 90D range pills */}
        <div className="flex items-center p-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px]">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              className={cn(
                "px-2.5 py-0.5 rounded-full font-medium transition-all duration-200",
                currentPeriod === p
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
              onClick={() => {
                setCurrentPeriod(p);
                onPeriodChange?.(p);
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPI & Change Delta */}
      <div className="space-y-1">
        <div className="text-3xl font-extrabold text-zinc-100 tracking-tight">{value}</div>
        <div className="flex items-center space-x-1.5 text-xs">
          <span
            className={cn(
              "font-medium inline-flex items-center",
              changePercent >= 0 ? "text-emerald-400" : "text-amber-400",
            )}
          >
            {changePercent >= 0 ? "▲" : "▼"} {Math.abs(changePercent)}%
          </span>
          <span className="text-zinc-400">{changeLabel}</span>
        </div>
      </div>

      {/* Dual Wave Sparkline Chart with Kokonut UI Scrubber */}
      <div className="relative pt-2 pb-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
          {/* Dashed Previous Period Line */}
          <path
            d={previousPath}
            fill="none"
            stroke="#52525b"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />

          {/* Solid White Current Period Line */}
          <path
            d={currentPath}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Kokonut Draggable / Interactive Scrubber Indicators (orange dashed pins) */}
          {/* Left Scrubber Pin */}
          <line
            x1="70"
            y1="25"
            x2="70"
            y2="95"
            stroke="#f97316"
            strokeWidth={1.5}
            strokeDasharray="2 2"
          />
          <circle cx="70" cy="95" r="3" fill="#f97316" />

          {/* Right Scrubber Pin */}
          <line
            x1="260"
            y1="25"
            x2="260"
            y2="95"
            stroke="#f97316"
            strokeWidth={1.5}
            strokeDasharray="2 2"
          />
          <circle cx="260" cy="95" r="3" fill="#f97316" />

          {/* Active Anchor Dot */}
          <circle
            cx="340"
            cy="47"
            r="4"
            fill="#ffffff"
            stroke="#09090b"
            strokeWidth={1.5}
          />
        </svg>

        {/* Scrubber Date Labels & Legend */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-b border-zinc-800/60 pb-2">
          <span>Sep 15</span>
          <span className="text-zinc-400">--- Previous period</span>
          <span>Oct 14</span>
        </div>
      </div>

      {/* Segmented Horizontal Share Bar */}
      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden flex space-x-0.5">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={cn("h-full transition-all duration-300", seg.color ?? "bg-zinc-200")}
            style={{ width: `${seg.sharePercent}%` }}
            title={`${seg.label}: ${seg.value} (${seg.sharePercent}%)`}
          />
        ))}
      </div>

      {/* Segment Breakdown Rows */}
      <div className="space-y-2 pt-1 text-xs">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-zinc-300">
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  seg.color ? seg.color : i === 0 ? "bg-white" : i === 1 ? "bg-zinc-400" : "bg-zinc-600",
                )}
              />
              <span className="truncate">{seg.label}</span>
            </div>
            <div className="flex items-center space-x-3 text-right">
              <span className="font-semibold text-zinc-100">{seg.value}</span>
              <span className="text-zinc-500 w-8">{seg.sharePercent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
