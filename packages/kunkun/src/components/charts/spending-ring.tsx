import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface SpendingRingSlice {
  id: string;
  name: string;
  amount: number;
  formattedAmount: string;
  color: string; // hex or hsl
  subtext?: string;
}

export interface SpendingRingProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  slices?: readonly SpendingRingSlice[];
  className?: string;
}

const DEFAULT_SLICES: SpendingRingSlice[] = [
  {
    id: "sonnet",
    name: "Claude 3.7 Sonnet",
    amount: 1250,
    formattedAmount: "$1,250.00",
    color: "#00d8f6", // Cyan
    subtext: "45% of total · High reasoning",
  },
  {
    id: "gpt4o",
    name: "Codex (GPT-4o)",
    amount: 486,
    formattedAmount: "$486.00",
    color: "#10b981", // Emerald
    subtext: "18% of total · Fast generation",
  },
  {
    id: "opus",
    name: "Claude 3.5 Opus",
    amount: 398,
    formattedAmount: "$398.00",
    color: "#da7756", // Coral
    subtext: "14% of total · Complex analysis",
  },
  {
    id: "gemini",
    name: "Gemini 2.5 Pro",
    amount: 313,
    formattedAmount: "$313.00",
    color: "#eab308", // Amber
    subtext: "11% of total · 2M context",
  },
  {
    id: "local",
    name: "Local Models",
    amount: 214,
    formattedAmount: "$214.00",
    color: "#a855f7", // Purple
    subtext: "8% of total · Ollama offline",
  },
  {
    id: "misc",
    name: "Embedding & Cache",
    amount: 87,
    formattedAmount: "$87.00",
    color: "#71717a", // Zinc
    subtext: "4% of total · Vector storage",
  },
];

export function SpendingRing({
  title = "Cycle spending",
  slices = DEFAULT_SLICES,
  className,
  ...props
}: SpendingRingProps) {
  const [activeId, setActiveId] = React.useState<string>(slices[0]?.id ?? "");

  const activeSlice = slices.find((s) => s.id === activeId) ?? slices[0]!;
  const totalAmount = slices.reduce((acc, s) => acc + s.amount, 0);

  // SVG parameters for donut ring
  const size = 260;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute slice arc offsets
  const arcSegments = React.useMemo(() => {
    let accumulatedAngle = 0;
    return slices.map((s) => {
      const share = totalAmount > 0 ? s.amount / totalAmount : 0;
      const strokeDasharray = `${share * circumference} ${circumference}`;
      // Rotate by accumulated angle - 90deg (so 0 is at 12 o'clock)
      const rotation = accumulatedAngle * 360 - 90;
      accumulatedAngle += share;
      return {
        ...s,
        strokeDasharray,
        rotation,
        sharePercent: Math.round(share * 100),
      };
    });
  }, [slices, totalAmount, circumference]);

  return (
    <div
      className={cn(
        "rounded-3xl bg-[#0c0c0e] border border-zinc-800/80 p-6 shadow-2xl flex flex-col space-y-5 select-none max-w-sm",
        className,
      )}
      {...props}
    >
      {/* Header with Title and Total */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{title}</span>
        <span className="text-sm font-bold text-zinc-100">
          ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {/* Rotary Dial Donut Ring with Apex Pointer ▼ */}
      <div className="relative flex flex-col items-center justify-center pt-1 pb-1">
        {/* Top Apex Indicator Pin (▼) */}
        <div className="text-zinc-100 text-[10px] mb-0.5 animate-pulse">▼</div>

        <div className="relative w-[240px] h-[240px] flex items-center justify-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full transform -rotate-0 cursor-pointer">
            {arcSegments.map((seg) => {
              const isActive = seg.id === activeId;
              return (
                <circle
                  key={seg.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isActive ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={0}
                  transform={`rotate(${seg.rotation} ${size / 2} ${size / 2})`}
                  className="transition-all duration-300 hover:opacity-90"
                  style={{
                    filter: isActive ? `drop-shadow(0 0 10px ${seg.color}88)` : undefined,
                  }}
                  onClick={() => setActiveId(seg.id)}
                />
              );
            })}
          </svg>

          {/* Center Circular Card */}
          <div className="absolute inset-[46px] rounded-full bg-[#141417] border border-zinc-800/80 flex flex-col items-center justify-center text-center p-3 shadow-inner">
            <div className="flex items-center space-x-1.5 text-[11px] text-zinc-300">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: activeSlice.color }}
              />
              <span className="truncate max-w-[100px] font-medium">{activeSlice.name}</span>
            </div>

            <div className="text-xl font-extrabold text-zinc-100 pt-0.5">
              {activeSlice.formattedAmount}
            </div>

            <div className="text-[10px] text-zinc-500 pt-0.5 leading-tight">
              {activeSlice.subtext ?? `${Math.round((activeSlice.amount / totalAmount) * 100)}% of total`}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 2-Column Legend Grid matching Kokonut UI */}
      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
        {slices.map((s) => {
          const isActive = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              className={cn(
                "flex items-center justify-between p-2 rounded-xl border text-left transition-all duration-200",
                isActive
                  ? "bg-zinc-800/90 border-zinc-700 shadow-sm"
                  : "bg-zinc-900/40 border-transparent hover:bg-zinc-900/80 hover:border-zinc-800",
              )}
              onClick={() => setActiveId(s.id)}
            >
              <div className="flex items-center space-x-1.5 truncate pr-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-zinc-300 truncate text-[11px]">{s.name.split(" ")[0]}</span>
              </div>
              <span className="font-semibold text-zinc-200 text-[11px] shrink-0">
                ${s.amount.toFixed(0)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
