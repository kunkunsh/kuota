import "./style.css";
import * as React from "react";
// @ts-ignore
import { createRoot } from "react-dom/client";
import { KuotaDashboard } from "./app.js";
import { MenuBarPopoverView } from "./components/views/menu-bar-popover-view.js";
import { Loader } from "./components/kokonutui/loader.js";
import { ThemeProvider } from "./lib/theme.js";
import { I18nProvider } from "./lib/i18n.js";
import {
  computeTrayTitle,
  detectQuotaAlertEvents,
  getProviderMeta,
  type MenuBarDisplayMode,
  type QuotaSnapshot,
  type QuotaForecastV1,
  type QuotaHistoryEventV1,
} from "@kuota/core";

// Offline fallback fixture data matching clean schema
const mockSnapshots: QuotaSnapshot[] = [
  {
    provider: "claude",
    status: "ok",
    fetchedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    source: "claude-oauth-usage",
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
    fetchedAt: new Date(Date.now() - 6 * 60_000).toISOString(),
    source: "codex-app-server",
    windows: [
      {
        windowId: "weekly.all",
        usedPercent: 39,
        remainingPercent: 61,
        resetAt: new Date(Date.now() + 5.1 * 86_400_000).toISOString(),
      },
    ],
    errorCode: null,
  },
  {
    provider: "antigravity",
    status: "ok",
    fetchedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    source: "agy-cli-probe",
    windows: [
      {
        windowId: "gemini.quota",
        usedPercent: 50,
        remainingPercent: 50,
        resetAt: new Date(Date.now() + 5 * 3_600_000).toISOString(),
      },
    ],
    errorCode: null,
  },
];

function computeSeriesFromEvents(events: readonly QuotaHistoryEventV1[]): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const e of events) {
    if (
      e.kind === "quota_observed" &&
      "windowId" in e &&
      e.windowId &&
      typeof e.usedPercent === "number"
    ) {
      const key = `${e.provider}/${e.windowId}`;
      if (!result[key]) result[key] = [];
      result[key].push(e.usedPercent);
    }
  }
  return result;
}

async function loadHistoryData(): Promise<{
  events: QuotaHistoryEventV1[];
  forecasts: QuotaForecastV1[];
}> {
  let events: QuotaHistoryEventV1[] = [];
  let forecasts: QuotaForecastV1[] = [];

  const isTauri =
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const hRes = await invoke<any>("get_quota_history", {});
      if (hRes && Array.isArray(hRes.events)) events = hRes.events;
      const fRes = await invoke<any>("get_quota_forecast", {});
      if (fRes && Array.isArray(fRes.forecasts)) forecasts = fRes.forecasts;
      return { events, forecasts };
    } catch (err) {
      console.warn("Tauri history invoke failed, falling back to fetch", err);
    }
  }

  try {
    const hRes = await fetch("/api/history");
    if (hRes.ok) {
      const hJson = await hRes.json();
      if (hJson && Array.isArray(hJson.events)) events = hJson.events;
    }
    const fRes = await fetch("/api/forecast");
    if (fRes.ok) {
      const fJson = await fRes.json();
      if (fJson && Array.isArray(fJson.forecasts)) forecasts = fJson.forecasts;
    }
  } catch {
    // offline fallback
  }

  return { events, forecasts };
}

async function loadQuotaStatus(forceFresh = false): Promise<QuotaSnapshot[] | null> {
  const isTauri =
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const command = forceFresh ? "refresh_quota" : "get_quota_status";
      const json = await invoke<any>(command, { fresh: forceFresh });
      console.log(`[Tauri ${command}] result:`, json);
      if (json && Array.isArray(json.providers) && json.providers.length > 0) {
        return json.providers;
      }
    } catch (err) {
      console.warn("Tauri invoke failed, falling back to fetch", err);
    }
  }

  try {
    const endpoint = forceFresh ? "/api/status?fresh=1" : "/api/status";
    const res = await fetch(endpoint);
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.providers) && json.providers.length > 0) {
        return json.providers;
      }
    }
  } catch {
    // offline or static fallback
  }

  return null;
}

function DevApp() {
  const params = new URLSearchParams(window.location.search);
  const initialRoute = (params.get("route") || "overview") as any;
  const islandMode = (params.get("mode") || "launcher") as any;
  const isTrayParam = params.get("window") === "tray" || params.get("route") === "popover";
  const [isTray, setIsTray] = React.useState<boolean>(isTrayParam);
  const [snapshots, setSnapshots] = React.useState<QuotaSnapshot[]>([]);
  const [historyEvents, setHistoryEvents] = React.useState<QuotaHistoryEventV1[]>([]);
  const [forecasts, setForecasts] = React.useState<QuotaForecastV1[]>([]);
  const [loading, setLoading] = React.useState(true);
  const prevSnapshotsRef = React.useRef<QuotaSnapshot[]>([]);

  React.useEffect(() => {
    if (
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    ) {
      import("@tauri-apps/api/webviewWindow")
        .then(({ getCurrentWebviewWindow }) => {
          try {
            const win = getCurrentWebviewWindow();
            if (win && win.label === "tray") {
              setIsTray(true);
            }
          } catch {}
        })
        .catch(() => {});
    }
  }, []);

  const fetchLiveStatus = React.useCallback(
    async (forceFresh = false) => {
      try {
        setLoading(true);
        const [data, histData] = await Promise.all([
          loadQuotaStatus(forceFresh),
          loadHistoryData(),
        ]);

        if (histData) {
          setHistoryEvents(histData.events);
          setForecasts(histData.forecasts);
        }

        if (data && data.length > 0) {
          setSnapshots(data);
          if (
            typeof window !== "undefined" &&
            ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
          ) {
            try {
              const { invoke } = await import("@tauri-apps/api/core");
              const userCfg = ((await invoke("get_user_config")) as any) || {};
              const displayMode = (userCfg.menuBarDisplayMode || "icon_only") as MenuBarDisplayMode;
              const title = computeTrayTitle(data, displayMode);
              await invoke("update_tray_title", { title });

              // Notifications check
              if (userCfg.enableNotifications !== false && prevSnapshotsRef.current.length > 0) {
                const threshold = userCfg.notificationThreshold || 15;
                const alerts = detectQuotaAlertEvents(data, prevSnapshotsRef.current, threshold);
                for (const alert of alerts) {
                  const pMeta = getProviderMeta(alert.provider);
                  if (alert.type === "low_quota") {
                    await invoke("send_desktop_notification", {
                      title: "Kuota · Low Quota Warning",
                      subtitle: `${pMeta.name} is running low`,
                      body: `Remaining quota is down to ${alert.remainingPercent}%. Time to pace or switch.`,
                      sound: true,
                    });
                  } else if (alert.type === "quota_reset") {
                    await invoke("send_desktop_notification", {
                      title: "Kuota · Quota Restored",
                      subtitle: `${pMeta.name} reset completed`,
                      body: `Quota has been restored to ${alert.remainingPercent}%. Ready to build!`,
                      sound: true,
                    });
                  }
                }
              }
              prevSnapshotsRef.current = data;
            } catch {}
          }
        } else if (snapshots.length === 0) {
          setSnapshots(mockSnapshots);
        }
      } catch {
        if (snapshots.length === 0) {
          setSnapshots(mockSnapshots);
        }
      } finally {
        setLoading(false);
      }
    },
    [snapshots.length],
  );

  React.useEffect(() => {
    (window as any).__KUOTA_REFRESH = () => fetchLiveStatus(true);
    void fetchLiveStatus(false);
  }, [fetchLiveStatus]);

  if (loading && snapshots.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100">
        <Loader
          size="md"
          title="Connecting to local AI quota providers..."
          subtitle="Querying live telemetry from Antigravity, Claude Code, and Codex"
        />
      </div>
    );
  }

  if (isTray) {
    return (
      <KuotaDashboard
        initialRoute="popover"
        islandMode={islandMode}
        snapshots={snapshots}
        forecasts={forecasts}
        series={computeSeriesFromEvents(historyEvents)}
        events={historyEvents}
        isRefreshing={loading}
        onRefresh={() => fetchLiveStatus(true)}
      />
    );
  }

  return (
    <KuotaDashboard
      initialRoute={initialRoute}
      islandMode={islandMode}
      snapshots={snapshots}
      forecasts={forecasts}
      series={computeSeriesFromEvents(historyEvents)}
      events={historyEvents}
      isRefreshing={loading}
      onRefresh={() => fetchLiveStatus(true)}
    />
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <ThemeProvider>
      <I18nProvider>
        <DevApp />
      </I18nProvider>
    </ThemeProvider>,
  );
}
