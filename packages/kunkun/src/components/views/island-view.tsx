import * as React from "react";
import { PacedProgress } from "../paced-progress.js";
import { AppleKey, AppleKeyCombo } from "../ui/apple-keyboard.js";
import { ProviderIcon } from "../ui/provider-icon.js";
import { calculatePace, windowProfile, type QuotaSnapshot } from "@kuota/core";
import {
  Search,
  RefreshCw,
  Bell,
  ExternalLink,
  Calendar,
  Command,
  Laptop,
  Sparkles,
  CircleDollarSign,
} from "lucide-react";

export interface IslandViewProps {
  snapshots: readonly QuotaSnapshot[];
  now?: Date;
  onOpenDashboard?: () => void;
  mode?: "launcher" | "island";
}

export function IslandView({
  snapshots,
  now = new Date(),
  onOpenDashboard,
  mode = "launcher",
}: IslandViewProps) {
  let activeTab: "launcher" | "island" = mode;
  let setActiveTab: (tab: "launcher" | "island") => void = () => {};
  try {
    const [tab, setTab] = React.useState<"launcher" | "island">(mode);
    activeTab = tab;
    setActiveTab = setTab;
  } catch {
    // In headless test environments without React renderer dispatcher
    activeTab = mode;
  }

  return (
    <div className="flex flex-col space-y-4 max-w-[420px] mx-auto p-4 text-zinc-100">
      {/* Mode switcher */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-tight text-zinc-200">Kuota Compact Surfaces</span>
        </div>
        <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 p-0.5 text-[11px]">
          <button
            type="button"
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === "launcher"
                ? "bg-zinc-800 text-zinc-100 font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={() => setActiveTab("launcher")}
          >
            (A) Kunkun Launcher
          </button>
          <button
            type="button"
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === "island"
                ? "bg-zinc-800 text-zinc-100 font-medium"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={() => setActiveTab("island")}
          >
            (B) Menu Bar / Island
          </button>
        </div>
      </div>

      {activeTab === "launcher" ? (
        /* (A) Kunkun Launcher Preview matching 11-kunkun-island.png (A) */
        <div className="bg-[#121214] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Top Search bar */}
          <div className="flex items-center space-x-3 px-4 py-3.5 border-b border-zinc-800/80 bg-zinc-900/40">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              type="text"
              readOnly
              value="kuota"
              className="bg-transparent text-sm text-zinc-100 font-medium focus:outline-none w-full"
            />
          </div>

          <div className="grid grid-cols-12 divide-x divide-zinc-800/80">
            {/* Left Action Menu */}
            <div className="col-span-5 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">Kuota</span>
                </div>
                <AppleKey size="sm">↵</AppleKey>
              </div>

              <button
                type="button"
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800/60 text-zinc-300 text-left transition-colors"
                onClick={onOpenDashboard}
              >
                <div className="flex items-center space-x-2">
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Open full dashboard</span>
                </div>
                <AppleKeyCombo keys={["⌘", "↵"]} />
              </button>

              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800/60 text-zinc-300 transition-colors">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Refresh</span>
                </div>
                <AppleKeyCombo keys={["⌘", "R"]} />
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-800/60 text-zinc-300 transition-colors">
                <div className="flex items-center space-x-2">
                  <Bell className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Set alerts</span>
                </div>
                <AppleKeyCombo keys={["⌘", "A"]} />
              </div>
            </div>

            {/* Right Preview Panel */}
            <div className="col-span-7 p-3.5 space-y-3 bg-zinc-950/30">
              <div className="flex items-center space-x-2 pb-1 border-b border-zinc-800/60">
                <span className="text-xs font-semibold text-zinc-200">AI Quota</span>
                <span className="text-[10px] text-zinc-500">Your AI usage and remaining quota</span>
              </div>

              {/* Provider Preview Rows */}
              <div className="space-y-2.5">
                {snapshots.map((s) => {
                  const main = s.windows[0];
                  if (!main) return null;
                  const profile = windowProfile(s.provider, main.windowId, main.resetAt, now);
                  const reset = main.resetAt ? new Date(main.resetAt) : null;
                  const start =
                    reset && profile.durationMs !== null
                      ? new Date(reset.getTime() - profile.durationMs)
                      : null;

                  const pace = calculatePace({
                    now,
                    startAt: start,
                    resetAt: reset,
                    usedPercent: main.usedPercent,
                    semantics: profile.semantics,
                    startSource: start ? "inferred" : "unknown",
                  });

                  return (
                    <div
                      key={s.provider}
                      className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1.5">
                          <ProviderIcon provider={s.provider} size={14} />
                          <span className="font-semibold capitalize text-zinc-200">{s.provider}</span>
                        </div>
                        <span className="font-bold text-zinc-100">
                          {main.remainingPercent !== null
                            ? `${main.remainingPercent.toFixed(0)}% left`
                            : "—"}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {main.windowId} · Resets in {reset ? `${Math.max(1, Math.round((reset.getTime() - now.getTime()) / 3_600_000))}h` : "unknown"}
                      </div>
                      {/* Exactly ONE white vertical pace tick on remaining balance bar */}
                      <PacedProgress
                        remainingPercent={main.remainingPercent}
                        idealRemainingPercent={pace ? 100 - pace.idealUsedPercent : null}
                        quality={pace?.quality}
                        heightClass="h-1.5"
                        showLegend={false}
                        barColor={
                          s.provider === "claude"
                            ? "bg-[#da7756]"
                            : s.provider === "codex"
                              ? "bg-[#5c82ff]"
                              : "bg-emerald-500"
                        }
                      />
                    </div>
                  );
                })}
              </div>

              {/* Forecast footer badge */}
              <div className="flex items-center space-x-2 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[10px] text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>At this pace: likely 1 day before reset · <strong className="text-amber-400">medium confidence</strong></span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* (B) Dynamic Island HUD Glance matching Reference-WarSaint-Dynamic-Island-Pace.png */
        <div className="bg-[#0c0c0e] border border-zinc-800 rounded-3xl p-4 shadow-2xl space-y-3.5">
          <div className="flex items-center justify-between text-xs pb-1 border-b border-zinc-800/60">
            <span className="font-semibold text-zinc-200">Today ▾</span>
            <span className="text-[10px] text-zinc-400">HUD Glance</span>
          </div>

          {/* 4 Quadrants */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Quadrant 1: Claude Code */}
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 truncate">
                  <ProviderIcon provider="claude" size={14} />
                  <span className="text-xs font-semibold text-zinc-200 truncate">Claude · huakun.shen@…</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono shrink-0">Max 20x</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-zinc-400">Week ↻ 3d 4h</span>
                <span className="text-sm font-bold text-zinc-100">42% left</span>
              </div>
              <PacedProgress
                remainingPercent={42}
                idealRemainingPercent={45}
                quality="exact"
                heightClass="h-2"
                barColor="bg-[#da7756]"
                showLegend={false}
              />
            </div>

            {/* Quadrant 2: Codex */}
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <ProviderIcon provider="codex" size={14} />
                  <span className="text-xs font-semibold text-zinc-200">Codex</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-400 font-mono flex items-center gap-1">
                  Pro <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-zinc-400">Week ↻ 4d 17h</span>
                <span className="text-sm font-bold text-zinc-100">59% left</span>
              </div>
              <PacedProgress
                remainingPercent={59}
                idealRemainingPercent={67}
                quality="exact"
                heightClass="h-2"
                barColor="bg-[#5c82ff]"
                showLegend={false}
              />
            </div>

            {/* Quadrant 3: OpenCode Telemetry */}
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <ProviderIcon provider="opencode" size={14} />
                  <span className="text-xs font-semibold text-zinc-200">OpenCode</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-[10px] text-zinc-500">Today</span>
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-sm font-bold text-zinc-100">$7.74</span>
                  <span className="text-[9px] text-zinc-500">2 min. ago</span>
                </div>
              </div>
              <div className="text-[10px] text-zinc-400">104M · 30% from cache</div>
            </div>

            {/* Quadrant 4: Spending API Value with Segmented Bar */}
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <CircleDollarSign className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-200">Spending</span>
                </div>
                <span className="text-[10px] text-zinc-500">API value</span>
              </div>
              <div className="flex items-baseline space-x-1.5 pt-0.5">
                <span className="text-base font-extrabold text-zinc-100">$30.23</span>
                <span className="text-[10px] text-zinc-500">API value</span>
              </div>
              {/* Warsaint 3-segment bar: Claude coral, Codex blue, Antigravity emerald */}
              <div className="h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden flex space-x-0.5">
                <div className="h-full bg-[#da7756]" style={{ width: "50%" }} title="Claude: $15.10" />
                <div className="h-full bg-[#5c82ff]" style={{ width: "33%" }} title="Codex: $10.00" />
                <div className="h-full bg-emerald-400" style={{ width: "17%" }} title="OpenCode: $5.13" />
              </div>
              <div className="text-[10px] text-zinc-400">256M tokens · 70% from cache</div>
            </div>
          </div>

          <div className="text-center pt-1">
            <button
              type="button"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center space-x-1.5"
              onClick={onOpenDashboard}
            >
              <span>Open Kuota Dashboard</span>
              <AppleKeyCombo keys={["⌘", "K"]} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
