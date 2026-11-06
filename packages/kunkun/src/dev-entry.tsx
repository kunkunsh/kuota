import * as React from "react";
// @ts-ignore
import { createRoot } from "react-dom/client";
import { KuotaDashboard } from "./app.js";
import type { QuotaSnapshot, QuotaForecastV1, QuotaHistoryEventV1 } from "@kuota/core";

// High-fidelity fixture data matching 01-overview.png and 02-history-forecast.png
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
      {
        windowId: "sonnet.family",
        usedPercent: 32,
        remainingPercent: 68,
        resetAt: new Date(Date.now() + 3.5 * 86_400_000).toISOString(),
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

const mockForecasts: QuotaForecastV1[] = [
  {
    schemaVersion: 1,
    provider: "claude",
    windowId: "weekly.all",
    computedAt: new Date().toISOString(),
    currentUsedPercent: 55,
    idealUsedPercent: 50,
    observedSpanHours: 84,
    sampleCount: 72,
    slopePercentPerHour: 0.65,
    exhaustedAt: new Date(Date.now() + 2.8 * 86_400_000).toISOString(),
    projectedUsedAtResetPercent: 108,
    expectedTimeToLimitHours: 67,
    mode: "all-window",
    quality: "medium",
    reasons: ["Moderate confidence (short window, 72 samples)"],
  },
  {
    schemaVersion: 1,
    provider: "codex",
    windowId: "weekly.all",
    computedAt: new Date().toISOString(),
    currentUsedPercent: 39,
    idealUsedPercent: 28,
    observedSpanHours: 120,
    sampleCount: 144,
    slopePercentPerHour: 0.28,
    exhaustedAt: null, // On pace, safe to reset
    projectedUsedAtResetPercent: 62,
    expectedTimeToLimitHours: null,
    mode: "all-window",
    quality: "high",
    reasons: ["High confidence (consistent pacing over 5 days)"],
  },
];

const mockSeries: Record<string, number[]> = {
  "claude/weekly.all": [10, 15, 22, 28, 35, 42, 48, 55],
  "claude/primary.5h": [10, 25, 45, 60, 78],
  "codex/weekly.all": [5, 12, 18, 25, 30, 34, 39],
  "antigravity/gemini.quota": [10, 20, 30, 40, 50],
};

const mockEvents: QuotaHistoryEventV1[] = [
  {
    schemaVersion: 1,
    eventId: "e1f8a93b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f",
    kind: "quota_observed",
    observedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    recordedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    provider: "claude",
    accountScope: null,
    deviceId: "local-mac-station-01",
    windowId: "weekly.all",
    epochId: null,
    semantics: "fixed",
    startAt: null,
    resetAt: new Date(Date.now() + 3.5 * 86_400_000).toISOString(),
    usedPercent: 55,
    remainingPercent: 45,
    source: "claude-oauth-usage",
    state: "ok",
    errorCode: null,
  },
  {
    schemaVersion: 1,
    eventId: "d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1fa1b2c3d4e5f6a7b8c9d0e1f",
    kind: "quota_observed",
    observedAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    recordedAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    provider: "claude",
    accountScope: null,
    deviceId: "local-mac-station-01",
    windowId: "weekly.all",
    epochId: null,
    semantics: "fixed",
    startAt: null,
    resetAt: new Date(Date.now() + 4.5 * 86_400_000).toISOString(),
    usedPercent: 42,
    remainingPercent: 58,
    source: "claude-oauth-usage",
    state: "ok",
    errorCode: null,
  },
  {
    schemaVersion: 1,
    eventId: "c3d4e5f6a7b8c9d0e1fa1b2c3d4e5f6a7b8c9d0e1fd2e3f4a5b6c7d8e9f0a1b2c3",
    kind: "quota_observed",
    observedAt: new Date(Date.now() - 48 * 3_600_000).toISOString(),
    recordedAt: new Date(Date.now() - 48 * 3_600_000).toISOString(),
    provider: "codex",
    accountScope: null,
    deviceId: "local-mac-station-01",
    windowId: "weekly.all",
    epochId: null,
    semantics: "fixed",
    startAt: null,
    resetAt: new Date(Date.now() + 6.1 * 86_400_000).toISOString(),
    usedPercent: 28,
    remainingPercent: 72,
    source: "codex-app-server",
    state: "ok",
    errorCode: null,
  },
];

function DevApp() {
  const params = new URLSearchParams(window.location.search);
  const initialRoute = (params.get("route") || "overview") as any;
  const islandMode = (params.get("mode") || "launcher") as any;
  const [snapshots, setSnapshots] = React.useState<QuotaSnapshot[]>(mockSnapshots);
  const [loading, setLoading] = React.useState(false);

  const fetchLiveStatus = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/status");
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.providers) && json.providers.length > 0) {
          setSnapshots(json.providers);
        }
      }
    } catch {
      // In offline / standalone static mode, mockSnapshots remains active
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchLiveStatus();
  }, [fetchLiveStatus]);

  return (
    <KuotaDashboard
      initialRoute={initialRoute}
      islandMode={islandMode}
      snapshots={snapshots}
      forecasts={mockForecasts}
      series={mockSeries}
      events={mockEvents}
      onRefresh={fetchLiveStatus}
    />
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<DevApp />);
}
