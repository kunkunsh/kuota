import * as React from "react";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  createHashHistory,
  createMemoryHistory,
  RouterProvider,
  Outlet,
  Link,
  useNavigate,
  useRouterState,
  useRouteContext,
} from "@tanstack/react-router";
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
import type {
  QuotaForecastV1,
  QuotaHistoryEventV1,
  QuotaSnapshot,
} from "@kuota/core";
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
import { ThemeToggleButton, useTheme } from "./lib/theme.js";
import { LanguageToggleButton, useI18n } from "./lib/i18n.js";

export type DashboardRoutePath =
  | "/overview"
  | "/history"
  | "/detail"
  | "/connections"
  | "/usage"
  | "/projects"
  | "/benchmarks"
  | "/data"
  | "/alerts"
  | "/settings"
  | "/island"
  | "/popover";

export interface KuotaRouterContext {
  snapshots: readonly QuotaSnapshot[];
  historyEvents: readonly QuotaHistoryEventV1[];
  forecasts: readonly QuotaForecastV1[];
  series: Readonly<Record<string, readonly number[]>>;
  now: Date;
  isRefreshing: boolean;
  onRefresh?: () => void | Promise<void>;
  selectedProvider: string;
  setSelectedProvider: (id: string) => void;
  islandMode?: "launcher" | "island";
}

// 1. Root Route
const rootRoute = createRootRouteWithContext<KuotaRouterContext>()({
  component: () => <Outlet />,
});

// 2. Dashboard Layout Component
function DashboardLayout() {
  const ctx = useRouteContext({ from: rootRoute.id });
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { resolvedTheme } = useTheme();
  const { t } = useI18n();

  const isDesktop =
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  const handleStartDragging = React.useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [data-no-drag]")) {
      return;
    }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().startDragging();
    } catch {}
  }, []);

  const handleToggleMaximize = React.useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [data-no-drag]")) {
      return;
    }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch {}
  }, []);

  const navItems = [
    { to: "/overview", labelKey: "nav.overview", fallback: "Overview", icon: LayoutDashboard },
    { to: "/history", labelKey: "nav.history", fallback: "History & Forecast", icon: LineChart },
    { to: "/detail", labelKey: "nav.detail", fallback: "Provider Detail", icon: Layers },
    { to: "/connections", labelKey: "nav.connections", fallback: "Connections", icon: Cable },
    { to: "/usage", labelKey: "nav.usage", fallback: "Usage & Value", icon: CircleDollarSign },
    { to: "/projects", labelKey: "nav.projects", fallback: "Projects", icon: FolderGit2 },
    { to: "/benchmarks", labelKey: "nav.benchmarks", fallback: "Benchmarks", icon: Activity },
    { to: "/data", labelKey: "nav.data", fallback: "Data & Sync", icon: Database },
    { to: "/alerts", labelKey: "nav.alerts", fallback: "Alerts", icon: Bell },
    { to: "/settings", labelKey: "nav.settings", fallback: "Settings", icon: Settings2 },
    { to: "/island", labelKey: "nav.island", fallback: "Island Preview", icon: AppWindow },
  ];

  const currentTitle = React.useMemo(() => {
    const matched = navItems.find((n) => n.to === currentPath);
    if (matched) return t(matched.labelKey, matched.fallback);
    if (currentPath === "/" || currentPath === "") return t("nav.overview", "Overview");
    return "Kuota";
  }, [currentPath, t, navItems]);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 font-sans antialiased overflow-hidden transition-colors duration-200">
      {/* Sidebar Navigation */}
      <aside className="w-56 flex-shrink-0 border-r border-slate-200 dark:border-zinc-800 bg-slate-100/90 dark:bg-[#111113] flex flex-col justify-between select-none">
        <div className="flex flex-col">
          {/* Top Logo / Drag Header */}
          <div
            data-tauri-drag-region
            onMouseDown={handleStartDragging}
            onDoubleClick={handleToggleMaximize}
            className={`h-11 border-b border-slate-200 dark:border-zinc-800/80 flex items-center space-x-2.5 px-3 select-none cursor-default ${
              isDesktop ? "pl-[78px]" : ""
            }`}
          >
            <KuotaLogo
              size={20}
              withBackground={false}
              theme={resolvedTheme}
              className="shrink-0 transition-transform duration-200 hover:scale-105"
            />
            <div className="flex flex-col" data-tauri-drag-region>
              <span
                data-tauri-drag-region
                className="font-semibold text-xs tracking-tight text-slate-900 dark:text-zinc-100"
              >
                Kuota
              </span>
              <span data-tauri-drag-region className="text-[9px] text-slate-500 dark:text-zinc-500">
                AI Quota Suite
              </span>
            </div>
          </div>

          <nav className="flex flex-col space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentPath === item.to || (item.to === "/overview" && (currentPath === "/" || currentPath === ""));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-no-drag
                  className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-white dark:bg-zinc-800/90 text-slate-900 dark:text-zinc-100 font-semibold shadow-xs border border-slate-200 dark:border-zinc-700/60"
                      : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-emerald-500 dark:text-emerald-400" : "text-slate-500 dark:text-zinc-400"
                    }`}
                  />
                  <span>{t(item.labelKey, item.fallback)}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-zinc-800/80 text-[10px] text-slate-500 dark:text-zinc-500 flex justify-between items-center">
          <div className="flex items-center space-x-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              title="All adapters healthy"
            />
            <span>v0.1.1</span>
          </div>
          <div className="flex items-center space-x-1">
            <LanguageToggleButton />
            <ThemeToggleButton />
          </div>
        </div>
      </aside>

      {/* Main Content Pane with Header Chrome */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50 dark:bg-[#09090b] transition-colors duration-200">
        {/* Top Header Drag Bar */}
        <header
          data-tauri-drag-region
          onMouseDown={handleStartDragging}
          onDoubleClick={handleToggleMaximize}
          className="h-11 shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-[#0c0c0e] flex items-center justify-between px-4 select-none cursor-default backdrop-blur-md"
        >
          <div data-tauri-drag-region className="flex items-center space-x-2 flex-1 h-full">
            <span data-tauri-drag-region className="text-xs font-semibold text-slate-800 dark:text-zinc-200 capitalize">
              {currentTitle}
            </span>
            <span data-tauri-drag-region className="text-slate-400 dark:text-zinc-600 text-xs">
              •
            </span>
            <span data-tauri-drag-region className="text-[11px] text-slate-500 dark:text-zinc-400">
              Live Quota Telemetry &amp; Pacing
            </span>
          </div>

          <div data-tauri-drag-region className="flex-1 h-full" />

          <div className="flex items-center space-x-3 text-xs" data-no-drag>
            {ctx.onRefresh && (
              <button
                type="button"
                data-no-drag
                disabled={ctx.isRefreshing}
                onClick={() => ctx.onRefresh?.()}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white text-[11px] font-medium transition-colors border border-slate-300 dark:border-zinc-700/50 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                title="Trigger immediate live quota probe"
              >
                {ctx.isRefreshing ? (
                  <>
                    <Loader size="xs" variant="emerald" />
                    <span className="text-emerald-500 dark:text-emerald-400 font-medium">Probing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 text-slate-500 dark:text-zinc-400" />
                    <span>{t("nav.refresh")}</span>
                  </>
                )}
              </button>
            )}
            <span className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-zinc-400" data-no-drag>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  ctx.isRefreshing ? "bg-amber-400 animate-ping" : "bg-emerald-500 animate-pulse"
                }`}
              />
              <span className="font-mono text-[10px] text-slate-600 dark:text-zinc-400">
                {ctx.isRefreshing ? "sampling" : "healthy"}
              </span>
            </span>
          </div>
        </header>

        {/* Dynamic Route View */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {ctx.isRefreshing && ctx.snapshots.length === 0 && (
            <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Loader size="xs" variant="emerald" />
                <span className="font-medium">
                  Connecting to local AI quota providers (Antigravity · Claude · Codex)...
                </span>
              </div>
              <span className="text-[10px] text-emerald-400/80 font-mono">sampling...</span>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// 3. Define Route Nodes
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "dashboard-layout",
  component: DashboardLayout,
});

// Index Route (maps to Overview)
const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/",
  component: OverviewRouteComponent,
});

const overviewRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/overview",
  component: OverviewRouteComponent,
});

function OverviewRouteComponent() {
  const ctx = useRouteContext({ from: rootRoute.id });
  const navigate = useNavigate();

  return (
    <OverviewView
      snapshots={ctx.snapshots}
      forecasts={ctx.forecasts}
      series={ctx.series}
      now={ctx.now}
      onSelectProvider={(id) => {
        ctx.setSelectedProvider(id);
        navigate({ to: "/detail" });
      }}
    />
  );
}

const historyRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/history",
  component: function HistoryRouteComponent() {
    const ctx = useRouteContext({ from: rootRoute.id });
    return <HistoryView events={ctx.historyEvents} forecasts={ctx.forecasts} />;
  },
});

const detailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/detail",
  component: function DetailRouteComponent() {
    const ctx = useRouteContext({ from: rootRoute.id });
    return (
      <ProviderDetailView
        snapshots={ctx.snapshots}
        selectedId={ctx.selectedProvider}
        onSelectProvider={ctx.setSelectedProvider}
      />
    );
  },
});

const connectionsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/connections",
  component: function ConnectionsRouteComponent() {
    const ctx = useRouteContext({ from: rootRoute.id });
    const navigate = useNavigate();
    return (
      <ConnectionsView
        snapshots={ctx.snapshots}
        onRefresh={ctx.onRefresh}
        onNavigate={(target) => {
          navigate({ to: `/${target}` as any });
        }}
      />
    );
  },
});

const usageRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/usage",
  component: () => <UsageView />,
});

const projectsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/projects",
  component: () => <ProjectsView />,
});

const benchmarksRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/benchmarks",
  component: () => <BenchmarksView />,
});

const dataRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/data",
  component: () => <DataSyncView />,
});

const alertsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/alerts",
  component: () => <AlertsView />,
});

const settingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/settings",
  component: () => <SettingsView />,
});

const islandRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: "/island",
  component: function IslandRouteComponent() {
    const ctx = useRouteContext({ from: rootRoute.id });
    return <IslandView snapshots={ctx.snapshots} now={ctx.now} mode={ctx.islandMode} />;
  },
});

// Standalone Popover Route (full-bleed for compact menu bar HUD)
const popoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/popover",
  component: function PopoverRouteComponent() {
    const ctx = useRouteContext({ from: rootRoute.id });
    const navigate = useNavigate();
    return (
      <MenuBarPopoverView
        snapshots={ctx.snapshots}
        forecasts={ctx.forecasts}
        events={ctx.historyEvents}
        isRefreshing={ctx.isRefreshing}
        onRefresh={ctx.onRefresh}
        onOpenDashboard={() => {
          navigate({ to: "/overview" });
        }}
      />
    );
  },
});

// 4. Build Route Tree
const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    indexRoute,
    overviewRoute,
    historyRoute,
    detailRoute,
    connectionsRoute,
    usageRoute,
    projectsRoute,
    benchmarksRoute,
    dataRoute,
    alertsRoute,
    settingsRoute,
    islandRoute,
  ]),
  popoverRoute,
]);

// 5. Create Router instance with Hash History for desktop Tauri & SPA safety
export function createKuotaRouter(initialPath?: string) {
  const isBrowser = typeof window !== "undefined" && typeof window.history !== "undefined";

  let initialEntries: string[] = ["/overview"];
  if (initialPath) {
    initialEntries = [initialPath.startsWith("/") ? initialPath : `/${initialPath}`];
  } else if (isBrowser) {
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace(/^#/, "");
    if (urlParams.get("view") === "popover" || urlParams.get("tray") === "true") {
      initialEntries = ["/popover"];
    } else if (hash.startsWith("/")) {
      initialEntries = [hash];
    }
  }

  const history = isBrowser
    ? createHashHistory()
    : createMemoryHistory({ initialEntries });

  return createRouter({
    routeTree,
    history,
    defaultPreload: "intent",
    context: {
      snapshots: [],
      historyEvents: [],
      forecasts: [],
      series: {},
      now: new Date(),
      isRefreshing: false,
      selectedProvider: "codex",
      setSelectedProvider: () => {},
    },
  });
}

export type KuotaRouter = ReturnType<typeof createKuotaRouter>;

export interface KuotaRouterProviderProps {
  router: KuotaRouter;
  context: KuotaRouterContext;
}

export function KuotaRouterProvider({ router, context }: KuotaRouterProviderProps) {
  return <RouterProvider router={router} context={context} />;
}
