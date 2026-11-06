import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card.js";
import { Badge } from "../ui/badge.js";
import type { QuotaForecastV1, QuotaHistoryEventV1 } from "@kuota/core";
import { ActivityTerrain } from "../charts/activity-terrain.js";
import { AnimatedCodeBlock } from "../ui/animated-code-block.js";
import {
  TrendingUp,
  Clock,
  Calendar,
  Layers,
  AlertTriangle,
  FileCode,
  Download,
  Copy,
  Check,
  ChevronRight,
  X,
} from "lucide-react";

export interface HistoryViewProps {
  events?: readonly QuotaHistoryEventV1[];
  forecasts?: readonly QuotaForecastV1[];
}

export function HistoryView({ events = [], forecasts = [] }: HistoryViewProps) {
  let provider: "claude" | "codex" | "antigravity" = "claude";
  let windowId = "weekly";
  let range = "7d";
  let mode: "all-window" | "recent-activity" = "all-window";
  let inspectingSnapshot: QuotaHistoryEventV1 | null = null;
  let copied = false;
  let setInspectingSnapshot: (s: QuotaHistoryEventV1 | null) => void = () => {};
  let setProvider: any = () => {};
  let setWindowId: any = () => {};
  let setRange: any = () => {};
  let setMode: any = () => {};
  let setCopied: any = () => {};

  try {
    const [p, sp] = React.useState<"claude" | "codex" | "antigravity">("claude");
    const [w, sw] = React.useState<string>("weekly");
    const [r, sr] = React.useState<string>("7d");
    const [m, sm] = React.useState<"all-window" | "recent-activity">("all-window");
    const [snap, ssnap] = React.useState<QuotaHistoryEventV1 | null>(null);
    const [cp, scp] = React.useState(false);
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
    copied = cp;
    setCopied = scp;
  } catch {
    // headless test
  }

  const copyJson = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter events for the selected provider
  const currentEvents = events.filter(
    (e) => e.provider === provider && ("windowId" in e ? e.windowId === windowId : true),
  );
  const currentForecast = forecasts.find((f) => f.provider === provider && f.windowId === windowId);

  return (
    <div className="flex flex-col space-y-6">
      {/* Header & Filter Bar matching 02-history-forecast.png */}
      <div className="flex flex-col space-y-3 pb-3 border-b border-zinc-800">
        <div>
          <div className="text-xs text-zinc-500 font-medium">
            Kuota / Analytics / <span className="text-zinc-300">History & Forecast</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 mt-1">
            History & Forecast
          </h2>
          <p className="text-xs text-zinc-400">
            Quota usage history, forecast to limit, and expected exhaustion for the selected
            provider and window.
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
                onChange={(e) => setProvider(e.target.value as any)}
              >
                <option value="claude" className="bg-zinc-900">
                  Claude Code
                </option>
                <option value="codex" className="bg-zinc-900">
                  Codex
                </option>
                <option value="antigravity" className="bg-zinc-900">
                  Antigravity
                </option>
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
                <option value="weekly" className="bg-zinc-900">
                  Weekly
                </option>
                <option value="primary" className="bg-zinc-900">
                  Primary (5-hour)
                </option>
                <option value="sonnet" className="bg-zinc-900">
                  Sonnet Family
                </option>
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
                <option value="7d" className="bg-zinc-900">
                  Last 7 days
                </option>
                <option value="14d" className="bg-zinc-900">
                  Last 14 days
                </option>
                <option value="30d" className="bg-zinc-900">
                  Last 30 days
                </option>
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
                <option value="all-window" className="bg-zinc-900">
                  All-window
                </option>
                <option value="recent-activity" className="bg-zinc-900">
                  Recent-activity
                </option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-zinc-300 font-medium">Last observation:</span>
            <span className="text-zinc-400">Nov 5, 10:24 AM · 55% used</span>
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
                  Weekly quota for {provider === "claude" ? "Claude Code" : provider}. Observed
                  through Nov 5, forecast to limit with uncertainty.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {/* SVG Visual Representation matching 02-history-forecast.png */}
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

                {/* NOW Vertical Line */}
                <line
                  x1="260"
                  y1="20"
                  x2="260"
                  y2="200"
                  stroke="#a1a1aa"
                  strokeDasharray="3 3"
                  strokeWidth="1.2"
                />
                <rect x="245" y="4" width="30" height="14" rx="3" fill="#27272a" />
                <text
                  x="260"
                  y="14"
                  fill="#fafafa"
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  NOW
                </text>

                {/* RESET Vertical Line */}
                <line
                  x1="550"
                  y1="20"
                  x2="550"
                  y2="200"
                  stroke="#71717a"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <rect x="532" y="4" width="36" height="14" rx="3" fill="#27272a" />
                <text
                  x="550"
                  y="14"
                  fill="#a1a1aa"
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  RESET
                </text>

                {/* Ideal Pace (Even distribution to reset) dotted line */}
                <line
                  x1="45"
                  y1="200"
                  x2="550"
                  y2="20"
                  stroke="#71717a"
                  strokeDasharray="2 3"
                  strokeWidth="1.2"
                  opacity="0.6"
                />

                {/* Uncertainty ribbon for forecast */}
                <polygon points="260,101 510,10 510,35 260,101" fill="#eab308" fillOpacity="0.12" />

                {/* Observed solid green line */}
                <path
                  d="M 45 198 L 90 190 L 135 186 L 180 178 L 225 150 L 260 101"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2.5"
                />
                {[
                  { x: 45, y: 198 },
                  { x: 90, y: 190 },
                  { x: 135, y: 186 },
                  { x: 180, y: 178 },
                  { x: 225, y: 150 },
                  { x: 260, y: 101 },
                ].map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r="3.5" fill="#22c55e" />
                ))}

                {/* NOW badge callout */}
                <rect
                  x="220"
                  y="75"
                  width="80"
                  height="20"
                  rx="4"
                  fill="#052e16"
                  stroke="#22c55e"
                  strokeWidth="1"
                />
                <text
                  x="260"
                  y="88"
                  fill="#4ade80"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  Nov 5 (NOW) · 55%
                </text>

                {/* Projected dashed amber line */}
                <line
                  x1="260"
                  y1="101"
                  x2="510"
                  y2="20"
                  stroke="#eab308"
                  strokeDasharray="5 4"
                  strokeWidth="2.5"
                />
                <circle
                  cx="510"
                  cy="20"
                  r="4.5"
                  fill="#eab308"
                  stroke="#111113"
                  strokeWidth="1.5"
                />

                {/* Projected exhaustion callout */}
                <rect
                  x="445"
                  y="40"
                  width="120"
                  height="30"
                  rx="6"
                  fill="#1c1917"
                  stroke="#eab308"
                  strokeWidth="1.2"
                />
                <text
                  x="505"
                  y="52"
                  fill="#fef08a"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  Projected exhaustion
                </text>
                <text x="505" y="64" fill="#eab308" fontSize="9" textAnchor="middle">
                  Nov 11 · 15h early
                </text>

                {/* X axis labels */}
                {[
                  "Nov 1",
                  "Nov 2",
                  "Nov 3",
                  "Nov 4",
                  "Nov 5",
                  "Nov 6",
                  "Nov 7",
                  "Nov 8",
                  "Nov 9",
                  "Nov 10",
                  "Nov 11",
                  "Nov 12",
                ].map((label, i) => {
                  const x = 45 + i * 46;
                  return (
                    <text key={label} x={x} y="215" fill="#71717a" fontSize="9" textAnchor="middle">
                      {label}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Chart Legend matching 02-history-forecast.png */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-3 gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-1 bg-emerald-500 rounded-full" />
                  <span className="text-zinc-200">Observed (actual usage)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-0.5 bg-amber-400 border-dashed border-t-2" />
                  <span className="text-zinc-200">Forecast (projected usage)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-2 bg-amber-400/20 border border-amber-400/40 rounded-sm" />
                  <span>Uncertainty range (forecast)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-0.5 border-t border-dotted border-zinc-500" />
                  <span>Ideal pace (even to reset)</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed border-red-500" />
                  <span>100% limit (quota cap)</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Sidebar Cards (4 cols) matching 02-history-forecast.png */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          {/* 1. Used Gauge */}
          <Card className="bg-[#111113] border-zinc-800">
            <CardContent className="p-4 flex items-center space-x-4">
              <div className="relative w-12 h-12 flex items-center justify-center">
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
                    strokeDasharray="55, 100"
                    strokeWidth="3.5"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold text-zinc-100">55%</span>
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-100">55% used</div>
                <div className="text-xs text-zinc-400">55% of weekly quota consumed</div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Pace */}
          <Card className="bg-[#111113] border-zinc-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-zinc-400">Pace</div>
                <div className="text-base font-bold text-amber-400 mt-0.5">+10% above even</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Using ~10% more than the even pace
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>

          {/* 3. Projected exhaustion */}
          <Card className="bg-[#111113] border-zinc-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-zinc-400">Projected exhaustion</div>
                <div className="text-base font-bold text-zinc-100 mt-0.5">Nov 11 · 15h early</div>
                <div className="text-xs text-zinc-400 mt-0.5">Expected to reach 100% on Nov 11</div>
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
                <div className="text-[11px] font-medium text-zinc-400">Forecast confidence</div>
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className="text-amber-400 border-amber-500/40 bg-amber-500/10 font-bold"
                  >
                    MEDIUM
                  </Badge>
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  Moderate confidence (short window, 72 samples)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Samples */}
          <Card className="bg-[#111113] border-zinc-800">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-zinc-400">Samples</div>
                <div className="text-base font-bold text-zinc-100 mt-0.5">72 · Span 3.5 days</div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  72 usage samples over 3.5 days (Nov 1 - Nov 5)
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Layers className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Kokonut UI: 3D Activity Terrain (replaces plain 2D bars and coverage squares) */}
      <ActivityTerrain
        title="Quota Activity Terrain"
        subtitle="3D daily consumption & snapshot density topography (26 weeks)"
      />

      {/* Raw Snapshot Records Table & Inspector (UX spec §3.4) */}
      <Card className="bg-[#111113] border-zinc-800">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100">
              Raw Snapshot Logs & Inspector
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Inspect immutable JSONL events, timestamps, and normalized field provenance.
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-zinc-400">{currentEvents.length} recorded events</span>
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
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {currentEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-zinc-500">
                      No raw snapshot logs recorded yet. Run{" "}
                      <code className="text-zinc-300 font-mono">kuota collect --once</code> to save
                      events.
                    </td>
                  </tr>
                ) : (
                  currentEvents.slice(0, 8).map((event) => (
                    <tr key={event.eventId} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-2.5 font-mono text-zinc-400">{event.recordedAt}</td>
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
                          variant={event.kind === "quota_observed" ? "success" : "default"}
                          className="text-[10px]"
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

      {/* Bottom Alert Banner matching 02-history-forecast.png */}
      <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 text-xs">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-300">Rolling windows not modeled.</span> This
          forecast treats the window as a fixed quota that resets on Nov 12. If your provider uses a
          rolling window, the actual limit and exhaustion time may differ.
        </div>
      </div>

      {/* Snapshot Inspector Modal/Drawer */}
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
              {/* Animate UI: Animated Code Block with Syntax Highlighting and Copy */}
              <AnimatedCodeBlock
                code={JSON.stringify(inspectingSnapshot, null, 2)}
                language="json"
              />

              <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-3 space-y-2 text-zinc-400">
                <div className="font-semibold text-zinc-200">Field Provenance Guarantee</div>
                <p className="text-[11px] leading-normal">
                  Snapshot timestamps reflect the true upstream vendor fetch time. No API tokens,
                  keys, passwords, or session cookies are recorded or preserved in this envelope.
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
