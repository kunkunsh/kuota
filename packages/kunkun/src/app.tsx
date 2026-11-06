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

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-100 font-sans antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <aside
        className={`w-56 flex-shrink-0 border-r border-zinc-800 bg-[#111113] flex flex-col justify-between p-3 select-none ${
          isDesktop ? "pt-8" : ""
        }`}
      >
        <div className="flex flex-col space-y-4">
          <div
            data-tauri-drag-region
            className="flex items-center space-x-2.5 px-2 py-2 cursor-default"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500 font-bold text-zinc-950 text-xs shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              K
            </span>
            <div className="flex flex-col" data-tauri-drag-region>
              <span className="font-semibold text-xs tracking-tight text-zinc-100">Kuota</span>
              <span className="text-[10px] text-zinc-500">Kunkun Quota Suite</span>
            </div>
          </div>

          <nav className="flex flex-col space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = route === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
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

        <div className="p-2 border-t border-zinc-800/80 text-[10px] text-zinc-500 flex justify-between items-center">
          <span>v0.1.0 · Local-First</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="All adapters healthy" />
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className={`flex-1 overflow-y-auto p-6 bg-[#09090b] ${isDesktop ? "pt-8" : ""}`}>
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
  );
}
