import * as React from "react";
import {
  LayoutDashboard,
  LineChart,
  Layers,
  Cable,
  CircleDollarSign,
  FolderGit2,
  Activity,
  Database,
  Bell,
  Settings2,
  AppWindow,
} from "lucide-react";
import { OverviewView } from "./components/views/overview-view.js";
import { HistoryView } from "./components/views/history-view.js";
import { ProviderDetailView } from "./components/views/provider-detail-view.js";
import { ConnectionsView } from "./components/views/connections-view.js";
import { UsageView } from "./components/views/usage-view.js";
import { ProjectsView } from "./components/views/projects-view.js";
import { BenchmarksView } from "./components/views/benchmarks-view.js";
import { DataSyncView } from "./components/views/data-sync-view.js";
import { AlertsView } from "./components/views/alerts-view.js";
import { SettingsView } from "./components/views/settings-view.js";
import { IslandView } from "./components/views/island-view.js";
import type { QuotaForecastV1, QuotaHistoryEventV1, QuotaSnapshot } from "@kuota/core";

export type DashboardRoute =
  | "overview"
  | "history"
  | "detail"
  | "connections"
  | "usage"
  | "projects"
  | "benchmarks"
  | "data"
  | "alerts"
  | "settings"
  | "island";

export interface KuotaDashboardProps {
  initialRoute?: DashboardRoute;
  islandMode?: "launcher" | "island";
  snapshots?: readonly QuotaSnapshot[];
  historyEvents?: readonly QuotaHistoryEventV1[];
  events?: readonly QuotaHistoryEventV1[];
  forecasts?: readonly QuotaForecastV1[];
  series?: Readonly<Record<string, readonly number[]>>;
  now?: Date;
  onRefresh?: () => void;
}

const DEFAULT_SNAPSHOTS: readonly QuotaSnapshot[] = [
  {
    provider: "codex",
    status: "ok",
    fetchedAt: "2026-11-06T00:00:00.000Z",
    source: "codex-app-server",
    windows: [
      {
        windowId: "primary",
        usedPercent: 42,
        remainingPercent: 58,
        resetAt: "2026-11-06T05:00:00.000Z",
      },
      {
        windowId: "secondary",
        usedPercent: 68,
        remainingPercent: 32,
        resetAt: "2026-11-12T00:00:00.000Z",
      },
    ],
    errorCode: null,
  },
  {
    provider: "claude",
    status: "ok",
    fetchedAt: "2026-11-06T00:00:00.000Z",
    source: "claude-oauth-usage",
    windows: [
      {
        windowId: "session.5h",
        usedPercent: 25,
        remainingPercent: 75,
        resetAt: "2026-11-06T04:30:00.000Z",
      },
      {
        windowId: "weekly.all",
        usedPercent: 55,
        remainingPercent: 45,
        resetAt: "2026-11-10T00:00:00.000Z",
      },
    ],
    errorCode: null,
  },
  {
    provider: "antigravity",
    status: "ok",
    fetchedAt: "2026-11-06T00:00:00.000Z",
    source: "agy-cli-print",
    windows: [
      {
        windowId: "gemini.weekly",
        usedPercent: 30,
        remainingPercent: 70,
        resetAt: "2026-11-11T00:00:00.000Z",
      },
    ],
    errorCode: null,
  },
];

export function KuotaDashboard({
  initialRoute = "overview",
  islandMode = "launcher",
  snapshots = DEFAULT_SNAPSHOTS,
  historyEvents,
  events,
  forecasts = [],
  series = {
    "claude/weekly.all": [20, 32, 40, 48, 55],
    "codex/secondary": [45, 52, 60, 64, 68],
  },
  now = new Date(),
  onRefresh,
}: KuotaDashboardProps) {
  const resolvedEvents = events ?? historyEvents ?? [];
  const [route, setRoute] = React.useState<DashboardRoute>(initialRoute);
  const [selectedProvider, setSelectedProvider] = React.useState<string>("codex");

  const navItems: {
    id: DashboardRoute;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "history", label: "History & Forecast", icon: LineChart },
    { id: "detail", label: "Provider Detail", icon: Layers },
    { id: "connections", label: "Connections", icon: Cable },
    { id: "usage", label: "Usage & Value", icon: CircleDollarSign },
    { id: "projects", label: "Projects", icon: FolderGit2 },
    { id: "benchmarks", label: "Benchmarks", icon: Activity },
    { id: "data", label: "Data & Sync", icon: Database },
    { id: "alerts", label: "Alerts", icon: Bell },
    { id: "settings", label: "Settings", icon: Settings2 },
    { id: "island", label: "Island Preview", icon: AppWindow },
  ];

  const isDesktop =
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  const handleStartDragging = React.useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary mouse button
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [data-no-drag]")) {
      return;
    }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().startDragging();
    } catch {
      // Ignore in non-Tauri / test environments
    }
  }, []);

  const handleToggleMaximize = React.useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [data-no-drag]")) {
      return;
    }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch {
      // Ignore in non-Tauri / test environments
    }
  }, []);

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-100 font-sans antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-56 flex-shrink-0 border-r border-zinc-800 bg-[#111113] flex flex-col justify-between select-none">
        <div className="flex flex-col">
          {/* Top Logo / Drag Header */}
          <div
            data-tauri-drag-region
            onMouseDown={handleStartDragging}
            onDoubleClick={handleToggleMaximize}
            className={`h-11 border-b border-zinc-800/80 flex items-center space-x-2.5 px-3 select-none cursor-default ${
              isDesktop ? "pl-[78px]" : ""
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500 font-bold text-zinc-950 text-[10px] shadow-[0_0_8px_rgba(16,185,129,0.3)]">
              K
            </span>
            <div className="flex flex-col" data-tauri-drag-region>
              <span
                data-tauri-drag-region
                className="font-semibold text-xs tracking-tight text-zinc-100"
              >
                Kuota
              </span>
              <span data-tauri-drag-region className="text-[9px] text-zinc-500">
                AI Quota Suite
              </span>
            </div>
          </div>

          <nav className="flex flex-col space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = route === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-no-drag
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-zinc-800/90 text-zinc-100 font-semibold shadow-sm border border-zinc-750"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                  }`}
                  onClick={() => setRoute(item.id)}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-emerald-400" : "text-zinc-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-zinc-800/80 text-[10px] text-zinc-500 flex justify-between items-center">
          <span>v0.1.0 · Local-First</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="All adapters healthy" />
        </div>
      </aside>

      {/* Main Content Pane with Header Chrome */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#09090b]">
        {/* Top Header Drag Bar */}
        <header
          data-tauri-drag-region
          onMouseDown={handleStartDragging}
          onDoubleClick={handleToggleMaximize}
          className="h-11 shrink-0 border-b border-zinc-800 bg-[#0c0c0e] flex items-center justify-between px-4 select-none cursor-default"
        >
          <div data-tauri-drag-region className="flex items-center space-x-2 flex-1 h-full">
            <span
              data-tauri-drag-region
              className="text-xs font-semibold text-zinc-200 capitalize"
            >
              {route === "detail"
                ? "Provider Detail"
                : route === "island"
                  ? "Island Preview"
                  : route}
            </span>
            <span data-tauri-drag-region className="text-zinc-600 text-xs">
              •
            </span>
            <span data-tauri-drag-region className="text-[11px] text-zinc-400">
              Live Quota Telemetry & Pacing
            </span>
          </div>

          <div data-tauri-drag-region className="flex-1 h-full" />

          <div className="flex items-center space-x-3 text-xs" data-no-drag>
            {onRefresh && (
              <button
                type="button"
                data-no-drag
                onClick={onRefresh}
                className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white text-[11px] font-medium transition-colors border border-zinc-700/50 cursor-pointer"
              >
                Refresh
              </button>
            )}
            <span className="flex items-center space-x-1.5 text-[11px] text-zinc-400" data-no-drag>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Telemetry</span>
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {route === "overview" && (
            <OverviewView
              snapshots={snapshots}
              forecasts={forecasts}
              series={series}
              now={now}
              onSelectProvider={(id) => {
                setSelectedProvider(id);
                setRoute("detail");
              }}
            />
          )}

          {route === "history" && <HistoryView events={resolvedEvents} forecasts={forecasts} />}

          {route === "detail" && (
            <ProviderDetailView
              snapshots={snapshots}
              selectedId={selectedProvider}
              onSelectProvider={setSelectedProvider}
            />
          )}

          {route === "connections" && <ConnectionsView onRefresh={onRefresh} />}

          {route === "usage" && <UsageView />}

          {route === "projects" && <ProjectsView />}

          {route === "benchmarks" && <BenchmarksView />}

          {route === "data" && <DataSyncView />}

          {route === "alerts" && <AlertsView />}

          {route === "settings" && <SettingsView />}

          {route === "island" && <IslandView snapshots={snapshots} now={now} mode={islandMode} />}
        </main>
      </div>
    </div>
  );
}
