import * as React from "react";
import { ThemeProvider } from "./lib/theme.js";
import { I18nProvider } from "./lib/i18n.js";
import type { QuotaForecastV1, QuotaHistoryEventV1, QuotaSnapshot } from "@kuota/core";
import {
  createKuotaRouter,
  KuotaRouterProvider,
  type KuotaRouterContext,
  type DashboardRoutePath,
} from "./router.js";

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
    source: "agy-cli-probe",
    billingModel: "subscription",
    windows: [
      {
        windowId: "claude-family",
        usedPercent: 31,
        remainingPercent: 69,
        resetAt: new Date(Date.now() + 6.4 * 86_400_000).toISOString(),
      },
      {
        windowId: "gemini-family",
        usedPercent: 50,
        remainingPercent: 50,
        resetAt: new Date(Date.now() + 5.1 * 86_400_000).toISOString(),
      },
    ],
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
  const [selectedProvider, setSelectedProvider] = React.useState<string>("codex");
  const [internalRefreshing, setInternalRefreshing] = React.useState(false);

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

  // Convert initialRoute into TanStack Router path
  const initialPath: string = initialRoute.startsWith("/") ? initialRoute : `/${initialRoute}`;

  // Stable TanStack Router instance using createHashHistory()
  const router = React.useMemo(() => createKuotaRouter(initialPath), [initialPath]);

  // Reactive context passed to TanStack Router
  const routerContext: KuotaRouterContext = React.useMemo(
    () => ({
      snapshots,
      historyEvents: resolvedEvents,
      forecasts,
      series,
      now,
      isRefreshing: activeRefreshing,
      onRefresh: handleRefresh,
      selectedProvider,
      setSelectedProvider,
      islandMode,
    }),
    [
      snapshots,
      resolvedEvents,
      forecasts,
      series,
      now,
      activeRefreshing,
      handleRefresh,
      selectedProvider,
      islandMode,
    ],
  );

  return <KuotaRouterProvider router={router} context={routerContext} />;
}

export function KuotaDashboard(props: KuotaDashboardProps) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <KuotaDashboardInner {...props} />
      </I18nProvider>
    </ThemeProvider>
  );
}
