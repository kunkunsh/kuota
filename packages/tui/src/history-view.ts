import { buildForecastV1, type QuotaForecastV1 } from "@kuota/core";
import { createLocalJsonlJournal } from "@kuota/history";
import { seriesKey } from "./dashboard.js";

export interface HistoryView {
  series: Record<string, number[]>;
  forecasts: QuotaForecastV1[];
}

const DAY = 86_400_000;

/** Read-only: the TUI never writes the journal; `kuota collect --once` owns appends. */
export async function loadHistoryView(directory: string, now: Date): Promise<HistoryView> {
  try {
    const { events } = await createLocalJsonlJournal({ directory }).readAll({
      from: new Date(now.getTime() - 30 * DAY).toISOString(),
      to: now.toISOString(),
    });
    const series: Record<string, number[]> = {};
    const keys = new Map<string, { provider: string; windowId: string }>();
    for (const event of [...events].sort((a, b) => a.observedAt.localeCompare(b.observedAt))) {
      if (event.kind !== "quota_observed" || event.usedPercent === null) continue;
      const key = seriesKey(event.provider, event.windowId);
      (series[key] ??= []).push(event.usedPercent);
      keys.set(key, event);
    }
    const forecasts = [...keys.values()].map((k) =>
      buildForecastV1({
        now,
        provider: k.provider,
        windowId: k.windowId,
        observations: events,
        mode: "all-window",
      }),
    );
    return { series, forecasts };
  } catch {
    return { series: {}, forecasts: [] };
  }
}
