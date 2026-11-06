import * as React from "react";
import { cn } from "../../lib/utils.js";

export function SparklineChart({
  values,
  width = 90,
  height = 24,
  className,
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length < 2) {
    return <span className="text-[10px] text-zinc-600">—</span>;
  }

  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  // Map to absolute 0-100 scale
  const points = valid.map((v, i) => {
    const x = padding + (i / (valid.length - 1)) * w;
    const y = padding + h - (Math.max(0, Math.min(100, v)) / 100) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const lastValue = valid[valid.length - 1]!;
  const strokeColor = lastValue >= 90 ? "#ef4444" : lastValue >= 75 ? "#f59e0b" : "#22c55e";

  return (
    <svg
      width={width}
      height={height}
      className={cn("overflow-visible inline-block align-middle", className)}
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
    </svg>
  );
}
