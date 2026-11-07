import * as React from "react";
import { PacedProgress } from "../paced-progress.js";
import { AppleKey, AppleKeyCombo } from "../ui/apple-keyboard.js";
import { ProviderIcon } from "../ui/provider-icon.js";
import {
  calculatePace,
  resolveIdealPace,
  windowProfile,
  getProviderMeta,
  formatCurrencyAmount,
  type QuotaSnapshot,
} from "@kuota/core";
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
  Wallet,
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
    activeTab = mode;
  }

  return (
    <div className="flex flex-col space-y-4 max-w-[420px] mx-auto p-4 text-zinc-100">
      {/* Mode switcher */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-tight text-zinc-200">
            Kuota Compact Surfaces
          </span>
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
        /* (A) Kunkun Launcher Preview */
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
                <span className="text-xs font-semibold text-zinc-200">AI Quota &amp; Wallets</span>
                <span className="text-[10px] text-zinc-500">Live pacing &amp; balances</span>
              </div>

              {/* Provider Preview Rows */}
              <div className="space-y-2.5">
                {snapshots.map((s) => {
                  const meta = getProviderMeta(s.provider);
                  const main = s.windows[0];

                  // Balance-only row
                  if (!main && s.balance?.balances && s.balance.balances.length > 0) {
                    const b = s.balance.balances[0];
                    if (!b) return null;
                    return (
                      <div
                        key={s.provider}
                        className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-1.5">
                            <ProviderIcon provider={s.provider} size={14} />
                            <span className="font-semibold text-zinc-200">{meta.shortName}</span>
                          </div>
                          <span className="font-bold text-zinc-100 font-mono">
                            {formatCurrencyAmount(b.totalBalance, b.currency)}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center justify-between">
                          <span>Prepaid Wallet</span>
                          <span>{b.currency} balance</span>
                        </div>
                      </div>
                    );
                  }

                  if (!main) return null;

                  const reset = main.resetAt ? new Date(main.resetAt) : null;
                  const pace = resolveIdealPace(main, s.provider, now);

                  return (
                    <div
                      key={s.provider}
                      className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1.5">
                          <ProviderIcon provider={s.provider} size={14} />
                          <span className="font-semibold text-zinc-200">{meta.shortName}</span>
                        </div>
                        <span className="font-bold text-zinc-100">
                          {main.remainingPercent !== null
                            ? `${main.remainingPercent.toFixed(0)}% left`
                            : "—"}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {main.windowId} · Resets in{" "}
                        {reset
                          ? `${Math.max(1, Math.round((reset.getTime() - now.getTime()) / 3_600_000))}h`
                          : "unknown"}
                      </div>
                      <PacedProgress
                        remainingPercent={main.remainingPercent}
                        idealRemainingPercent={pace ? pace.idealRemainingPercent : null}
                        quality={pace?.quality}
                        heightClass="h-1.5"
                        barColor={
                          s.provider === "claude"
                            ? "bg-[#da7756]"
                            : s.provider === "codex"
                              ? "bg-[#5c82ff]"
                              : "bg-emerald-500"
                        }
                        showLegend={false}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Forecast footer badge */}
              <div className="flex items-center space-x-2 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[10px] text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>
                  Telemetry active ·{" "}
                  <strong className="text-emerald-400">Verified local &amp; API probes</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* (B) Dynamic Island HUD Glance */
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
                  <span className="text-xs font-semibold text-zinc-200 truncate">Claude</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono shrink-0">
                  Max 20x
                </span>
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

            {/* Quadrant 3: OpenCode Go */}
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <ProviderIcon provider="opencodego" size={14} />
                  <span className="text-xs font-semibold text-zinc-200">OpenCode Go</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-[10px] text-zinc-500">Weekly Quota</span>
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-sm font-bold text-zinc-100">57% left</span>
                </div>
              </div>
              <div className="text-[10px] text-zinc-400">Go Plan · 40% monthly</div>
            </div>

            {/* Quadrant 4: DeepSeek / OpenRouter Balances */}
            <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <ProviderIcon provider="deepseek" size={14} />
                  <span className="text-xs font-semibold text-zinc-200">DeepSeek</span>
                </div>
                <span className="text-[10px] text-zinc-500">Wallet</span>
              </div>
              <div className="flex items-baseline space-x-1.5 pt-0.5">
                <span className="text-base font-extrabold text-zinc-100">$3.68</span>
                <span className="text-[10px] text-zinc-500">USD available</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden flex space-x-0.5">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: "95%" }}
                  title="Cash balance: $3.70"
                />
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: "5%" }}
                  title="Granted balance"
                />
              </div>
              <div className="text-[10px] text-zinc-400">Funded · Pay-as-you-go</div>
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
