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
  RefreshCw,
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
import { MenuBarPopoverView } from "./components/views/menu-bar-popover-view.js";
import { KuotaLogo } from "./components/ui/kuota-logo.js";
import { Loader } from "./components/kokonutui/loader.js";
import { ThemeProvider, ThemeToggleButton, useTheme } from "./lib/theme.js";
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
  | "island"
  | "popover";

export interface KuotaDashboardProps {
  initialRoute?: DashboardRoute;
  islandMode?: "launcher" | "island";
  snapshots?: readonly QuotaSnapshot[];
  historyEvents?: readonly QuotaHistoryEventV1[];
  events?: readonly QuotaHistoryEventV1[];
  forecasts?: readonly QuotaForecastV1[];
  series?: Readonly<Record<string, readonly number[]>>;
  now?: Date;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
}

const DEFAULT_SNAPSHOTS: QuotaSnapshot[] = [
  {
    provider: "claude",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    source: "claude-oauth-usage",
    billingModel: "subscription",
    windows: [
      {
        windowId: "weekly.all",
        usedPercent: 55,
        remainingPercent: 45,
        resetAt: new Date(Date.now() + 3.5 * 86_400_000).toISOString(),
      },
      {
        windowId: "primary.5h",
        usedPercent: 78,
        remainingPercent: 22,
        resetAt: new Date(Date.now() + 1.2 * 3_600_000).toISOString(),
      },
    ],
    errorCode: null,
  },
  {
    provider: "codex",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    source: "codex-app-server",
    billingModel: "subscription",
    windows: [
      {
        windowId: "weekly.all",
        usedPercent: 39,
        remainingPercent: 61,
        resetAt: new Date(Date.now() + 5.1 * 86_400_000).toISOString(),
      },
      {
        windowId: "secondary",
        usedPercent: 68,
        remainingPercent: 32,
        resetAt: new Date(Date.now() + 3.8 * 86_400_000).toISOString(),
      },
    ],
    errorCode: null,
  },
  {
    provider: "antigravity",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    source: "antigravity-storage",
    billingModel: "subscription",
    windows: [
      {
        windowId: "gemini-pro",
        usedPercent: 12,
        remainingPercent: 88,
        resetAt: new Date(Date.now() + 6.2 * 86_400_000).toISOString(),
      },
      {
        windowId: "claude-3-7-sonnet",
        usedPercent: 44,
        remainingPercent: 56,
        resetAt: new Date(Date.now() + 4.1 * 86_400_000).toISOString(),
      },
    ],
    errorCode: null,
  },
  {
    provider: "opencodego",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    source: "opencode-go-api",
    billingModel: "subscription",
    planType: "Go Plan",
    windows: [
      {
        windowId: "rolling",
        usedPercent: 15,
        remainingPercent: 85,
        resetAt: new Date(Date.now() + 1.8 * 3_600_000).toISOString(),
      },
      {
        windowId: "weekly",
        usedPercent: 43,
        remainingPercent: 57,
        resetAt: new Date(Date.now() + 4.2 * 86_400_000).toISOString(),
      },
      {
        windowId: "monthly",
        usedPercent: 60,
        remainingPercent: 40,
        resetAt: new Date(Date.now() + 18.5 * 86_400_000).toISOString(),
      },
    ],
    errorCode: null,
  },
  {
    provider: "deepseek",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    source: "deepseek-user-balance",
    billingModel: "balance",
    windows: [],
    balance: {
      balances: [
        {
          currency: "USD",
          totalBalance: 3.68,
          grantedBalance: 0,
          toppedUpBalance: 3.68,
          usage: null,
          limit: null,
          burnRateDaily: null,
          estimatedDaysLeft: null,
        },
        {
          currency: "CNY",
          totalBalance: -0.02,
          grantedBalance: 0,
          toppedUpBalance: -0.02,
          usage: null,
          limit: null,
          burnRateDaily: null,
          estimatedDaysLeft: null,
        },
      ],
    },
    errorCode: null,
  },
  {
    provider: "openrouter",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    source: "openrouter-api",
    billingModel: "hybrid",
    windows: [
      {
        windowId: "daily_free_limit",
        usedPercent: 25,
        remainingPercent: 75,
        resetAt: new Date(Date.now() + 0.6 * 86_400_000).toISOString(),
      },
    ],
    balance: {
      balances: [
        {
          currency: "USD",
          totalBalance: 20.0,
          grantedBalance: 0,
          toppedUpBalance: 20.0,
          usage: 20.0,
          limit: 40.0,
          burnRateDaily: 1.25,
          estimatedDaysLeft: 16,
        },
      ],
    },
    errorCode: null,
  },
];

function KuotaDashboardInner({
  initialRoute = "overview",
  islandMode = "launcher",
  snapshots = DEFAULT_SNAPSHOTS,
  historyEvents,
  events,
  forecasts = [],
  series = {},
  now = new Date(),
  onRefresh,
  isRefreshing,
}: KuotaDashboardProps) {
  const resolvedEvents = events ?? historyEvents ?? [];
  const [route, setRoute] = React.useState<DashboardRoute>(initialRoute);
  const [selectedProvider, setSelectedProvider] = React.useState<string>("codex");
  const [internalRefreshing, setInternalRefreshing] = React.useState(false);
  const { resolvedTheme } = useTheme();

  const activeRefreshing = isRefreshing ?? internalRefreshing;

  const handleRefresh = React.useCallback(async () => {
    if (activeRefreshing || !onRefresh) return;
    setInternalRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setInternalRefreshing(false);
    }
  }, [activeRefreshing, onRefresh]);

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

  if (route === "popover") {
    return (
      <MenuBarPopoverView
        snapshots={snapshots}
        forecasts={forecasts}
        events={events}
        isRefreshing={activeRefreshing}
        onRefresh={handleRefresh}
        onOpenDashboard={() => setRoute("overview")}
      />
    );
  }

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
            {/* Kuota SVG Vector Mark — Adaptive dark/light, unboxed glyph without container background */}
            <KuotaLogo
              size={20}
              withBackground={false}
              theme={resolvedTheme}
              className="shrink-0 transition-transform duration-200 hover:scale-105"
            />
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
          <div className="flex items-center space-x-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              title="All adapters healthy"
            />
            <span>v0.1.0 · Local-First</span>
          </div>
          <ThemeToggleButton />
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
            <span data-tauri-drag-region className="text-xs font-semibold text-zinc-200 capitalize">
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
              Live Quota Telemetry &amp; Pacing
            </span>
          </div>

          <div data-tauri-drag-region className="flex-1 h-full" />

          <div className="flex items-center space-x-3 text-xs" data-no-drag>
            {onRefresh && (
              <button
                type="button"
                data-no-drag
                disabled={activeRefreshing}
                onClick={handleRefresh}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white text-[11px] font-medium transition-colors border border-zinc-700/50 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                title="Trigger immediate live quota probe"
              >
                {activeRefreshing ? (
                  <>
                    <Loader size="xs" variant="emerald" />
                    <span className="text-emerald-400 font-medium">Probing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 text-zinc-400" />
                    <span>Refresh</span>
                  </>
                )}
              </button>
            )}
            <span className="flex items-center space-x-1.5 text-[11px] text-zinc-400" data-no-drag>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  activeRefreshing ? "bg-amber-400 animate-ping" : "bg-emerald-500 animate-pulse"
                }`}
              />
              <span>{activeRefreshing ? "Probing Adapters..." : "Live Telemetry"}</span>
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {activeRefreshing && (
            <div className="mb-4 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 transition-all duration-200">
              <div className="flex items-center space-x-2.5">
                <Loader size="xs" variant="emerald" />
                <span className="font-medium">
                  Connecting to local AI quota providers (Antigravity · Claude · Codex)...
                </span>
              </div>
              <span className="text-[10px] text-emerald-400/80 font-mono">sampling...</span>
            </div>
          )}
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

          {route === "connections" && (
            <ConnectionsView
              snapshots={snapshots}
              onRefresh={onRefresh}
              onNavigate={setRoute}
            />
          )}

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

export function KuotaDashboard(props: KuotaDashboardProps) {
  return (
    <ThemeProvider>
      <KuotaDashboardInner {...props} />
    </ThemeProvider>
  );
}
