import * as React from "react";
import { cn } from "../../lib/utils.js";

export interface ActivityTerrainDataPoint {
  col: number; // e.g. 0 to 25 (26 columns / weeks)
  row: number; // e.g. 0 to 3 (4 depth slices: Night, Morning, Afternoon, Evening)
  value: number; // 0 to 100 activity / token volume
  label?: string; // date or timestamp description
  count?: number; // snapshot count
}

export interface ActivityTerrainProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  data?: readonly ActivityTerrainDataPoint[];
  cols?: number;
  rows?: number;
  className?: string;
}

// Generate realistic deterministic activity dataset if none provided
function generateDefaultData(cols = 26, rows = 4): ActivityTerrainDataPoint[] {
  const points: ActivityTerrainDataPoint[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // Create organic terrain peaks and valleys
      const dist1 = Math.hypot(c - 7, r - 1.5);
      const dist2 = Math.hypot(c - 20, r - 2);
      const dist3 = Math.hypot(c - 14, r - 3);
      let v = 0;
      if (dist1 < 3.5) v += Math.cos((dist1 / 3.5) * Math.PI * 0.5) * 85;
      if (dist2 < 4.0) v += Math.cos((dist2 / 4.0) * Math.PI * 0.5) * 65;
      if (dist3 < 2.5) v += Math.cos((dist3 / 2.5) * Math.PI * 0.5) * 45;
      // Some background baseline activity
      const noise = ((c * 17 + r * 31) % 19) / 19;
      if (noise > 0.4) v += noise * 22;
      const finalVal = Math.min(100, Math.round(v));
      points.push({
        col: c,
        row: r,
        value: finalVal,
        label: `W${c + 1} · ${r === 0 ? "Night" : r === 1 ? "Morning" : r === 2 ? "Afternoon" : "Evening"}`,
        count: Math.round(finalVal * 0.8),
      });
    }
  }
  return points;
}

export function ActivityTerrain({
  title = "Activity",
  subtitle = "402 contributions in the last 26 weeks",
  data,
  cols = 26,
  rows = 4,
  className,
  ...props
}: ActivityTerrainProps) {
  const [mode, setMode] = React.useState<"flat" | "terrain">("terrain");
  const [hovered, setHovered] = React.useState<ActivityTerrainDataPoint | null>(null);

  const points = React.useMemo(() => data ?? generateDefaultData(cols, rows), [data, cols, rows]);

  // Geometry parameters for 3D isometric projection
  const tileWidth = 24;
  const tileHeight = 12;
  const maxHeight = 64;

  const svgWidth = 760;
  const svgHeight = 260;
  const originX = 140;
  const originY = 160;

  // Color shading based on value (0-100)
  const getShades = (val: number) => {
    if (val === 0) {
      return {
        top: "#18181b",
        left: "#131316",
        right: "#0f0f11",
      };
    }
    if (val < 25) {
      return {
        top: "#3f3f46",
        left: "#27272a",
        right: "#18181b",
      };
    }
    if (val < 50) {
      return {
        top: "#71717a",
        left: "#52525b",
        right: "#3f3f46",
      };
    }
    if (val < 75) {
      return {
        top: "#d4d4d8",
        left: "#a1a1aa",
        right: "#71717a",
      };
    }
    // Highest peak
    return {
      top: "#ffffff",
      left: "#e4e4e7",
      right: "#a1a1aa",
    };
  };

  // Sort points by depth order (back-to-front: col + row ascending)
  const sortedPoints = React.useMemo(() => {
    return [...points].sort((a, b) => a.col + a.row - (b.col + b.row));
  }, [points]);

  return (
    <div
      className={cn(
        "relative rounded-3xl bg-[#0c0c0e] border border-zinc-800/80 p-6 shadow-2xl flex flex-col space-y-4 select-none",
        className,
      )}
      {...props}
    >
      {/* Header with Title and Flat/Terrain Toggle Pill */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-base font-bold text-zinc-100">{title}</h3>
          <p className="text-xs text-zinc-400 font-normal">{subtitle}</p>
        </div>

        {/* Kokonut Flat / Terrain Switcher */}
        <div className="flex items-center p-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs">
          <button
            type="button"
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
              mode === "flat"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200",
            )}
            onClick={() => setMode("flat")}
          >
            Flat
          </button>
          <button
            type="button"
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
              mode === "terrain"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200",
            )}
            onClick={() => setMode("terrain")}
          >
            Terrain
          </button>
        </div>
      </div>

      {/* Main Visualization Canvas */}
      <div className="relative w-full h-[260px] flex items-center justify-center overflow-hidden">
        {mode === "terrain" ? (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full cursor-crosshair overflow-visible"
          >
            {sortedPoints.map((pt) => {
              // 2:1 Isometric Coordinate Transformation
              const isoX = originX + (pt.col * (tileWidth / 2) + pt.row * (tileWidth * 1.5));
              const isoY = originY + (-pt.col * (tileHeight * 0.45) + pt.row * (tileHeight * 1.1));

              const h = Math.round((pt.value / 100) * maxHeight);
              const shades = getShades(pt.value);
              const isHov = hovered?.col === pt.col && hovered?.row === pt.row;

              const halfW = tileWidth / 2;
              const halfH = tileHeight / 2;

              // Top face vertices (elevated by h)
              const topP1 = `${isoX},${isoY - halfH - h}`;
              const topP2 = `${isoX + halfW},${isoY - h}`;
              const topP3 = `${isoX},${isoY + halfH - h}`;
              const topP4 = `${isoX - halfW},${isoY - h}`;

              // Left face vertices
              const leftFace = `${isoX - halfW},${isoY - h} ${isoX},${isoY + halfH - h} ${isoX},${isoY + halfH} ${isoX - halfW},${isoY}`;

              // Right face vertices
              const rightFace = `${isoX},${isoY + halfH - h} ${isoX + halfW},${isoY - h} ${isoX + halfW},${isoY} ${isoX},${isoY + halfH}`;

              return (
                <g
                  key={`${pt.col}-${pt.row}`}
                  onMouseEnter={() => setHovered(pt)}
                  onMouseLeave={() => setHovered(null)}
                  className="transition-all duration-150"
                  style={{
                    filter: isHov ? "drop-shadow(0 0 8px rgba(255,255,255,0.8))" : undefined,
                  }}
                >
                  {/* Left Column Face */}
                  {h > 0 && (
                    <polygon
                      points={leftFace}
                      fill={shades.left}
                      stroke="#09090b"
                      strokeWidth={0.5}
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Right Column Face */}
                  {h > 0 && (
                    <polygon
                      points={rightFace}
                      fill={shades.right}
                      stroke="#09090b"
                      strokeWidth={0.5}
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Top Column Face */}
                  <polygon
                    points={`${topP1} ${topP2} ${topP3} ${topP4}`}
                    fill={shades.top}
                    stroke="#09090b"
                    strokeWidth={0.5}
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
          </svg>
        ) : (
          /* Flat 2D Heatmap Mode */
          <div className="w-full flex flex-col items-center justify-center space-y-1.5 py-4">
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className="flex space-x-1.5">
                {Array.from({ length: cols }).map((_, c) => {
                  const pt = points.find((p) => p.col === c && p.row === r);
                  const val = pt?.value ?? 0;
                  const shades = getShades(val);
                  return (
                    <div
                      key={c}
                      className="w-4 h-4 rounded-sm transition-transform hover:scale-125 border border-black/40"
                      style={{ backgroundColor: shades.top }}
                      onMouseEnter={() => pt && setHovered(pt)}
                      onMouseLeave={() => setHovered(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Floating Tooltip when Hovering a Voxel */}
        {hovered && (
          <div className="absolute top-2 left-6 pointer-events-none p-2 rounded-xl bg-zinc-900/95 border border-zinc-700/80 shadow-xl backdrop-blur-md text-xs space-y-0.5">
            <div className="font-semibold text-zinc-100">{hovered.label}</div>
            <div className="text-zinc-400">
              Activity volume: <strong className="text-white">{hovered.value}%</strong> · {hovered.count} snapshots
            </div>
          </div>
        )}
      </div>

      {/* Footer Legend: Less [■ ■ ■ ■ ■] More matching kokonut UI */}
      <div className="flex items-center justify-end space-x-2 text-xs text-zinc-500 pt-1">
        <span>Less</span>
        <div className="flex items-center space-x-1">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#18181b] border border-zinc-800" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#3f3f46]" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#71717a]" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#d4d4d8]" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#ffffff]" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
