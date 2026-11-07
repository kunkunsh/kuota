import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import {
  resolveIdealPace,
  type QuotaForecastV1,
  type QuotaHistoryEventV1,
} from "@kuota/core";
import { ActivityTerrain } from "../charts/activity-terrain.js";
import { AnimatedCodeBlock } from "../ui/animated-code-block.js";
import {
  TrendingUp,
  Clock,
  Layers,
  AlertTriangle,
  FileCode,
  X,
  Activity,
} from "lucide-react";

export interface HistoryViewProps {
  events?: readonly QuotaHistoryEventV1[];
  forecasts?: readonly QuotaForecastV1[];
}

const DEFAULT_PROVIDERS = [
  { id: "codex", name: "OpenAI Codex" },
  { id: "claude", name: "Claude Code" },
  { id: "antigravity", name: "Google Antigravity" },
  { id: "opencodego", name: "OpenCode Go" },
  { id: "openrouter", name: "OpenRouter" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "mimo", name: "Xiaomi MiMo" },
  { id: "openai", name: "OpenAI Platform" },
];

export function HistoryView({ events = [], forecasts = [] }: HistoryViewProps) {
  // Derive list of all providers present in events
  const presentProviders = Array.from(new Set(events.map((e) => e.provider))).filter(Boolean);
  const allProviderIds = Array.from(
    new Set([...presentProviders, ...DEFAULT_PROVIDERS.map((p) => p.id)]),
  );

  // Derive available windows for this provider
  const initialProvider = allProviderIds[0] ?? "codex";
  const initialWindows = Array.from(
    new Set(
      events
        .filter((e) => e.provider === initialProvider && "windowId" in e && e.windowId)
        .map((e: any) => e.windowId),
    ),
  );
  const fallbackWindow = initialWindows[0] ?? "weekly";

  let provider = initialProvider;
  let setProvider: (p: string) => void = () => {};
  let windowId = fallbackWindow;
  let setWindowId: (w: string) => void = () => {};
  let range = "7d";
  let setRange: (r: string) => void = () => {};
  let mode: "all-window" | "recent-activity" = "all-window";
  let setMode: (m: "all-window" | "recent-activity") => void = () => {};
  let inspectingSnapshot: QuotaHistoryEventV1 | null = null;
  let setInspectingSnapshot: (s: QuotaHistoryEventV1 | null) => void = () => {};

  try {
    const [p, sp] = React.useState<string>(initialProvider);
    const [w, sw] = React.useState<string>(fallbackWindow);
    const [r, sr] = React.useState<string>("7d");
    const [m, sm] = React.useState<"all-window" | "recent-activity">("all-window");
    const [snap, ssnap] = React.useState<QuotaHistoryEventV1 | null>(null);

    provider = p;
    setProvider = sp;
    windowId = w;
    setWindowId = sw;
    range = r;
    setRange = sr;
    mode = m;
    setMode = sm;
    inspectingSnapshot = snap;
    setInspectingSnapshot = ssnap;
  } catch {
    // Headless test without React dispatcher
  }

  // Windows for current provider
  const availableWindows = React.useMemo ? (() => {
    try {
      return React.useMemo(() => {
        const wins = new Set<string>();
        for (const e of events) {
          if (e.provider === provider && "windowId" in e && e.windowId) {
            wins.add(e.windowId);
          }
        }
        const list = Array.from(wins);
        return list.length > 0 ? list : ["primary", "weekly"];
      }, [events, provider]);
    } catch {
      return ["primary", "weekly"];
    }
  })() : ["primary", "weekly"];

  try {
    React.useEffect(() => {
      if (!availableWindows.includes(windowId) && availableWindows.length > 0) {
        setWindowId(availableWindows[0]!);
      }
    }, [availableWindows, windowId]);
  } catch {
    // headless test
  }

  // Time filtering
  const rangeDays = range === "30d" ? 30 : range === "14d" ? 14 : 7;
  const now = new Date();
  const rangeStartMs = now.getTime() - rangeDays * 86_400_000;

  // Filter measurable observed events
  const currentEvents = events
    .filter(
      (e) =>
        e.provider === provider &&
        ("windowId" in e ? e.windowId === windowId : true) &&
        e.kind === "quota_observed" &&
        typeof e.usedPercent === "number" &&
        new Date(e.observedAt).getTime() >= rangeStartMs,
    )
    .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());

  const currentForecast = forecasts.find(
    (f) => f.provider === provider && f.windowId === windowId,
  );

  const latestEvent = currentEvents[currentEvents.length - 1];
  const earliestEvent = currentEvents[0];

  // Pacing calculation
  const pace =
    latestEvent && typeof latestEvent.usedPercent === "number"
      ? resolveIdealPace(
          {
            windowId,
            usedPercent: latestEvent.usedPercent,
            resetAt: latestEvent.resetAt,
          },
          provider,
          now,
        )
      : null;

  // Compute dynamic SVG coordinates
  const svgGeometry = (() => {
    const leftPad = 45;
    const rightPad = 570;
    const topPad = 20;
    const bottomPad = 200;
    const plotWidth = rightPad - leftPad;
    const plotHeight = bottomPad - topPad;

    if (currentEvents.length === 0) {
      return { hasData: false, points: [], pathD: "", nowX: 300, resetX: null, xTicks: [] };
    }

    const t0 = new Date(earliestEvent!.observedAt).getTime();
    const tLast = new Date(latestEvent!.observedAt).getTime();
    const resetTime = latestEvent?.resetAt ? new Date(latestEvent.resetAt).getTime() : null;

    let tEnd = resetTime && resetTime > tLast ? resetTime : tLast + 86_400_000;
    let tStart = Math.min(t0, tLast - 86_400_000);
    if (tEnd <= tStart) tEnd = tStart + 86_400_000;

    const timeToX = (t: number) => {
      const frac = (t - tStart) / (tEnd - tStart);
      return Math.min(rightPad, Math.max(leftPad, leftPad + frac * plotWidth));
    };

    const usedToY = (pct: number) => {
      const clamped = Math.min(100, Math.max(0, pct));
      return bottomPad - (clamped / 100) * plotHeight;
    };

    const points = currentEvents.map((e) => ({
      x: timeToX(new Date(e.observedAt).getTime()),
      y: usedToY(e.usedPercent!),
      usedPercent: e.usedPercent!,
      time: e.observedAt,
    }));

    const pathD =
      points.length > 0
        ? "M " + points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")
        : "";

    const nowX = timeToX(tLast);
    const resetX = resetTime && resetTime > tStart && resetTime <= tEnd ? timeToX(resetTime) : null;

    let forecastLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
    let exhaustionLabel: string | null = null;

    if (currentForecast?.exhaustedAt && latestEvent) {
      const exTime = new Date(currentForecast.exhaustedAt).getTime();
      const exX = timeToX(exTime);
      forecastLine = {
        x1: nowX,
        y1: usedToY(latestEvent.usedPercent!),
        x2: exX,
        y2: topPad,
      };
      const exDate = new Date(currentForecast.exhaustedAt);
      exhaustionLabel = `${exDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${exDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    } else if (
      currentForecast?.projectedUsedAtResetPercent !== null &&
      currentForecast?.projectedUsedAtResetPercent !== undefined &&
      resetX
    ) {
      forecastLine = {
        x1: nowX,
        y1: usedToY(latestEvent?.usedPercent ?? 0),
        x2: resetX,
        y2: usedToY(currentForecast.projectedUsedAtResetPercent),
      };
    }

    const xTicks: { label: string; x: number }[] = [];
    const tickCount = 6;
    for (let i = 0; i <= tickCount; i++) {
      const tickTime = tStart + (i / tickCount) * (tEnd - tStart);
      const d = new Date(tickTime);
      xTicks.push({
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        x: leftPad + (i / tickCount) * plotWidth,
      });
    }

    return {
      hasData: true,
      points,
      pathD,
      nowX,
      resetX,
      forecastLine,
      exhaustionLabel,
      xTicks,
      lastPoint: points[points.length - 1],
    };
  })();

  const providerMeta = DEFAULT_PROVIDERS.find((p) => p.id === provider);
  const providerDisplayName = providerMeta ? providerMeta.name : provider;

  return (
    <div className="flex flex-col space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col space-y-3 pb-3 border-b border-zinc-800">
        <div>
          <div className="text-xs text-zinc-500 font-medium">
            Kuota / Analytics / <span className="text-zinc-300">History & Forecast</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 mt-1">
            History & Forecast
          </h2>
          <p className="text-xs text-zinc-400">
            Immutable snapshot log telemetry, linear pacing benchmarks, and regression forecasts.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Provider Select */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200">
              <span className="text-zinc-400 font-medium">Provider:</span>
              <select
                className="bg-transparent text-zinc-100 focus:outline-none cursor-pointer"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                {allProviderIds.map((id) => {
                  const meta = DEFAULT_PROVIDERS.find((p) => p.id === id);
                  return (
                    <option key={id} value={id} className="bg-zinc-900 text-zinc-100">
                      {meta ? meta.name : id}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Window Select */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200">
              <span className="text-zinc-400 font-medium">Window:</span>
              <select
                className="bg-transparent text-zinc-100 focus:outline-none cursor-pointer"
                value={windowId}
                onChange={(e) => setWindowId(e.target.value)}
              >
                {availableWindows.map((w) => (
                  <option key={w} value={w} className="bg-zinc-900 text-zinc-100">
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {/* Range Select */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200">
              <span className="text-zinc-400 font-medium">Range:</span>
              <select
                className="bg-transparent text-zinc-100 focus:outline-none cursor-pointer"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="7d" className="bg-zinc-900">Last 7 days</option>
                <option value="14d" className="bg-zinc-900">Last 14 days</option>
                <option value="30d" className="bg-zinc-900">Last 30 days</option>
              </select>
            </div>

            {/* Mode Select */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200">
              <span className="text-zinc-400 font-medium">Forecast mode:</span>
              <select
                className="bg-transparent text-zinc-100 focus:outline-none cursor-pointer"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
              >
                <option value="all-window" className="bg-zinc-900">All-window (full epoch)</option>
                <option value="recent-activity" className="bg-zinc-900">Recent-activity (48h)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${latestEvent ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
            <span className="text-zinc-300 font-medium">Last observation:</span>
            <span className="text-zinc-400">
              {latestEvent
                ? `${new Date(latestEvent.observedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${new Date(latestEvent.observedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · ${latestEvent.usedPercent}% used`
                : "No telemetry recorded yet"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Hero Chart on Left (8 cols) + Stats on Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Hero Chart Container (8 cols) */}
        <Card className="lg:col-span-8 bg-[#111113] border-zinc-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-100">
                  Quota Usage — History & Forecast
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  {providerDisplayName} ({windowId}). Real immutable measurements from local JSONL journal. Forecast model: {mode}.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            <div className="h-64 w-full relative pt-4 pb-2">
              <svg
                className="w-full h-full overflow-visible"
                viewBox="0 0 600 220"
                preserveAspectRatio="none"
              >
                {/* Horizontal grid lines */}
                {[0, 20, 40, 60, 80, 100].map((pct) => {
                  const y = 200 - (pct / 100) * 180;
                  return (
                    <g key={pct}>
                      <line x1="35" y1={y} x2="570" y2={y} stroke="#27272a" strokeWidth="0.8" />
                      <text x="30" y={y + 3} fill="#71717a" fontSize="10" textAnchor="end">
                        {pct}%
                      </text>
                    </g>
                  );
                })}

                {/* 100% limit red line */}
                <line
                  x1="35"
                  y1="20"
                  x2="570"
                  y2="20"
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
                <rect
                  x="40"
                  y="10"
                  width="65"
                  height="18"
                  rx="4"
                  fill="#ef4444"
                  fillOpacity="0.2"
                  stroke="#ef4444"
                  strokeWidth="1"
                />
                <text
                  x="72"
                  y="22"
                  fill="#ef4444"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  100% limit
                </text>

                {svgGeometry.hasData ? (
                  <>
                    {/* RESET Vertical Line */}
                    {svgGeometry.resetX !== null && (
                      <g>
                        <line
                          x1={svgGeometry.resetX}
                          y1="20"
                          x2={svgGeometry.resetX}
                          y2="200"
                          stroke="#71717a"
                          strokeDasharray="3 3"
                          strokeWidth="1"
                        />
                        <rect x={svgGeometry.resetX - 18} y="4" width="36" height="14" rx="3" fill="#27272a" />
                        <text
                          x={svgGeometry.resetX}
                          y="14"
                          fill="#a1a1aa"
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          RESET
                        </text>
                      </g>
                    )}

                    {/* NOW Vertical Line */}
                    <line
                      x1={svgGeometry.nowX}
                      y1="20"
                      x2={svgGeometry.nowX}
                      y2="200"
                      stroke="#a1a1aa"
                      strokeDasharray="3 3"
                      strokeWidth="1.2"
                    />
                    <rect x={svgGeometry.nowX - 15} y="4" width="30" height="14" rx="3" fill="#27272a" />
                    <text
                      x={svgGeometry.nowX}
                      y="14"
                      fill="#fafafa"
                      fontSize="8"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      NOW
                    </text>

                    {/* Observed Solid Line */}
                    {svgGeometry.pathD && (
                      <path
                        d={svgGeometry.pathD}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="2.5"
                      />
                    )}

                    {/* Sample dots */}
                    {svgGeometry.points.map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r="3.5"
                        fill="#22c55e"
                        className="transition-transform hover:scale-150"
                      />
                    ))}

                    {/* Callout badge for latest point */}
                    {svgGeometry.lastPoint && (
                      <g>
                        <rect
                          x={Math.max(40, svgGeometry.lastPoint.x - 45)}
                          y={Math.max(26, svgGeometry.lastPoint.y - 25)}
                          width="90"
                          height="20"
                          rx="4"
                          fill="#052e16"
                          stroke="#22c55e"
                          strokeWidth="1"
                        />
                        <text
                          x={Math.max(40, svgGeometry.lastPoint.x - 45) + 45}
                          y={Math.max(26, svgGeometry.lastPoint.y - 25) + 13}
                          fill="#4ade80"
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {svgGeometry.lastPoint.usedPercent}% used
                        </text>
                      </g>
                    )}

                    {/* Forecast Line */}
                    {svgGeometry.forecastLine && (
                      <g>
                        <line
                          x1={svgGeometry.forecastLine.x1}
                          y1={svgGeometry.forecastLine.y1}
                          x2={svgGeometry.forecastLine.x2}
                          y2={svgGeometry.forecastLine.y2}
                          stroke="#eab308"
                          strokeDasharray="5 4"
                          strokeWidth="2"
                        />
                        <circle
                          cx={svgGeometry.forecastLine.x2}
                          cy={svgGeometry.forecastLine.y2}
                          r="4"
                          fill="#eab308"
                          stroke="#111113"
                          strokeWidth="1.5"
                        />
                      </g>
                    )}

                    {/* Projected exhaustion callout */}
                    {svgGeometry.exhaustionLabel && svgGeometry.forecastLine && (
                      <g>
                        <rect
                          x={Math.min(440, Math.max(100, svgGeometry.forecastLine.x2 - 60))}
                          y="40"
                          width="120"
                          height="28"
                          rx="6"
                          fill="#1c1917"
                          stroke="#eab308"
                          strokeWidth="1.2"
                        />
                        <text
                          x={Math.min(440, Math.max(100, svgGeometry.forecastLine.x2 - 60)) + 60}
                          y="52"
                          fill="#fef08a"
                          fontSize="8.5"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          Projected exhaustion
                        </text>
                        <text
                          x={Math.min(440, Math.max(100, svgGeometry.forecastLine.x2 - 60)) + 60}
                          y="63"
                          fill="#eab308"
                          fontSize="8.5"
                          textAnchor="middle"
                        >
                          {svgGeometry.exhaustionLabel}
                        </text>
                      </g>
                    )}

                    {/* X axis labels */}
                    {svgGeometry.xTicks.map((tick, i) => (
                      <text
                        key={i}
                        x={tick.x}
                        y="215"
                        fill="#71717a"
                        fontSize="9"
                        textAnchor="middle"
                      >
                        {tick.label}
                      </text>
                    ))}
                  </>
                ) : (
                  /* Empty state */
                  <text x="300" y="110" fill="#71717a" fontSize="11" textAnchor="middle">
                    No snapshot logs recorded for this window yet. Telemetry daemon samples every 15 min.
                  </text>
                )}
              </svg>
            </div>

            {/* Informative HUD if few data points */}
            {currentEvents.length < 3 && currentEvents.length > 0 && (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-300">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    <strong>{currentEvents.length} snapshot{currentEvents.length === 1 ? "" : "s"} recorded.</strong> Background daemon records every 15 minutes. Trend slopes refine as new points arrive.
                  </span>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono">15m interval</span>
              </div>
            )}

            {/* Chart Legend */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-3 gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-1 bg-emerald-500 rounded-full" />
                  <span className="text-zinc-200">Observed (actual telemetry)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-0.5 bg-amber-400 border-dashed border-t-2" />
                  <span className="text-zinc-200">Forecast (projected trajectory)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed border-red-500" />
                  <span>100% quota limit</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Sidebar Cards (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          {/* 1. Used Gauge */}
          <Card className="bg-[#111113] border-zinc-800">
            <CardContent className="p-4 flex items-center space-x-4">
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#27272a"
                    strokeWidth="3.5"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#22c55e"
                    strokeDasharray={`${latestEvent?.usedPercent ?? 0}, 100`}
                    strokeWidth="3.5"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold text-zinc-100">
                  {latestEvent?.usedPercent !== undefined ? `${latestEvent.usedPercent}%` : "—%"}
                </span>
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-100">
                  {latestEvent?.usedPercent !== undefined ? `${latestEvent.usedPercent}% used` : "No Telemetry"}
                </div>
                <div className="text-xs text-zinc-400">
                  {latestEvent ? `${latestEvent.usedPercent}% of ${windowId} quota consumed` : "Awaiting first sample"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Pace */}
          <Card className="bg-[#111113] border-zinc-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-zinc-400">Linear Pacing</div>
                {pace ? (
                  <>
                    <div
                      className={`text-base font-bold mt-0.5 ${
                        pace.paceStatus === "ahead"
                          ? "text-emerald-400"
                          : pace.paceStatus === "behind"
                            ? "text-amber-400"
                            : "text-cyan-400"
                      }`}
                    >
                      {pace.paceStatus === "ahead"
                        ? `+${(pace.idealUsedPercent - pace.actualUsedPercent).toFixed(1)}% in reserve`
                        : pace.paceStatus === "behind"
                          ? `+${(pace.actualUsedPercent - pace.idealUsedPercent).toFixed(1)}% above pace`
                          : "On pace with schedule"}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Ideal budget: {pace.idealUsedPercent.toFixed(1)}% · Actual: {pace.actualUsedPercent}%
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-base font-bold text-zinc-300 mt-0.5">
                      {latestEvent?.resetAt ? "Calculating pace..." : "No reset schedule"}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">Window has no fixed deadline</div>
                  </>
                )}
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>

          {/* 3. Projected exhaustion */}
          <Card className="bg-[#111113] border-zinc-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-zinc-400">Projected Exhaustion</div>
                <div className="text-base font-bold text-zinc-100 mt-0.5">
                  {currentForecast?.exhaustedAt
                    ? new Date(currentForecast.exhaustedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : currentForecast?.quality === "insufficient"
                      ? "Accumulating samples"
                      : "Safe through reset"}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {currentForecast?.exhaustedAt
                    ? `Expected to hit 100% before reset`
                    : currentForecast?.reasons?.[0] ?? "Usage slope is within quota limit"}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                <Clock className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>

          {/* 4. Forecast confidence */}
          <Card className="bg-[#111113] border-zinc-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-zinc-400">Forecast Confidence</div>
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className={`font-bold ${
                      currentForecast?.quality === "high"
                        ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
                        : currentForecast?.quality === "medium"
                          ? "text-cyan-400 border-cyan-500/40 bg-cyan-500/10"
                          : currentForecast?.quality === "low"
                            ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
                            : "text-zinc-400 border-zinc-700 bg-zinc-800/40"
                    }`}
                  >
                    {(currentForecast?.quality ?? "INSUFFICIENT").toUpperCase()}
                  </Badge>
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  {currentForecast?.reasons?.join(" · ") || "Requires continuous samples over time"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Samples */}
          <Card className="bg-[#111113] border-zinc-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-zinc-400">Telemetry Samples</div>
                <div className="text-base font-bold text-zinc-100 mt-0.5">
                  {currentEvents.length} recorded
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {earliestEvent && latestEvent
                    ? `Span: ${(
                        (new Date(latestEvent.observedAt).getTime() -
                          new Date(earliestEvent.observedAt).getTime()) /
                        3_600_000
                      ).toFixed(1)}h`
                    : "Automatic periodic collection active"}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Layers className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3D Activity Terrain with Real Events Topography */}
      <ActivityTerrain
        title="Telemetry Activity Terrain"
        subtitle="3D hourly snapshot density & observation topography (26 weeks)"
        events={events}
      />

      {/* Raw Snapshot Records Table & Inspector */}
      <Card className="bg-[#111113] border-zinc-800">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100">
              Raw Snapshot Logs & Inspector
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Inspect immutable JSONL telemetry events, timestamps, and normalized field provenance.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-zinc-400">{events.length} total events in journal</span>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 font-medium">
                  <th className="py-2.5">Recorded At (UTC)</th>
                  <th className="py-2.5">Provider</th>
                  <th className="py-2.5">Window</th>
                  <th className="py-2.5">Used %</th>
                  <th className="py-2.5">Kind</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-500">
                      No raw snapshot logs recorded yet. Telemetry daemon runs every 15 minutes.
                    </td>
                  </tr>
                ) : (
                  [...events]
                    .reverse()
                    .slice(0, 10)
                    .map((event) => (
                      <tr key={event.eventId} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="py-2.5 font-mono text-zinc-400">
                          {new Date(event.recordedAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 font-medium text-zinc-200 capitalize">
                          {event.provider}
                        </td>
                        <td className="py-2.5 text-zinc-400">
                          {"windowId" in event ? event.windowId : "-"}
                        </td>
                        <td className="py-2.5 text-zinc-200 font-medium">
                          {"usedPercent" in event && event.usedPercent !== null
                            ? `${event.usedPercent}%`
                            : "-"}
                        </td>
                        <td className="py-2.5">
                          <Badge
                            variant={event.kind === "quota_observed" ? "default" : "outline"}
                            className={`text-[10px] ${
                              event.kind === "quota_observed"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : "text-zinc-400"
                            }`}
                          >
                            {event.kind}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors inline-flex items-center space-x-1"
                            onClick={() => setInspectingSnapshot(event)}
                          >
                            <FileCode className="w-3 h-3" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Alert Banner */}
      <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-300">Continuous Local History:</span> All snapshots are strictly stored locally in append-only JSONL files at <code className="font-mono text-amber-300">~/Library/Application Support/kuota/history/</code>. No usage data or API keys are ever transmitted off this device.
        </div>
      </div>

      {/* Snapshot Inspector Modal */}
      {inspectingSnapshot && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  Snapshot Envelope Inspector · {inspectingSnapshot.eventId.slice(0, 12)}…
                </h3>
              </div>
              <button
                type="button"
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                onClick={() => setInspectingSnapshot(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <AnimatedCodeBlock
                code={JSON.stringify(inspectingSnapshot, null, 2)}
                language="json"
              />

              <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-3 space-y-2 text-zinc-400">
                <div className="font-semibold text-zinc-200">Field Provenance Guarantee</div>
                <p className="text-[11px] leading-normal">
                  Snapshot timestamps reflect the true vendor fetch time. No API tokens,
                  keys, passwords, or session cookies are recorded in this immutable envelope.
                </p>
              </div>
            </div>

            <div className="p-3 border-t border-zinc-800 flex justify-end">
              <button
                type="button"
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
                onClick={() => setInspectingSnapshot(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
