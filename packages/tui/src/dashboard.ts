import {
  calculatePace,
  windowProfile,
  type PaceResult,
  type ProviderId,
  type QuotaForecastV1,
  type QuotaWindow,
} from "@kuota/core";

const BLOCKS = "▁▂▃▄▅▆▇█";
const clampPct = (value: number): number => Math.min(100, Math.max(0, value));

/** Absolute 0–100% scale so the shape never exaggerates small movements. Newest `width` points. */
export function sparkline(values: readonly number[], width: number): string {
  return values
    .filter((value) => Number.isFinite(value))
    .slice(-Math.max(0, width))
    .map((value) => BLOCKS[Math.round((clampPct(value) / 100) * 7)]!)
    .join("");
}

export type BarCell = "fill" | "empty" | "marker";

/**
 * One cell per column; the single `marker` cell is the white ideal-pace tick (time budget, not a forecast).
 * Fill represents remaining quota (`% left`), matching physical battery / tank intuition.
 */
export function barCells(
  remainingPercent: number,
  idealRemainingPercent: number | null,
  width: number,
): BarCell[] {
  const filled = Math.round((clampPct(remainingPercent) / 100) * width);
  const cells: BarCell[] = Array.from({ length: width }, (_, i) => (i < filled ? "fill" : "empty"));
  if (idealRemainingPercent !== null && width > 0) {
    cells[Math.round((clampPct(idealRemainingPercent) / 100) * (width - 1))] = "marker";
  }
  return cells;
}

export function describeExhaustion(forecast: QuotaForecastV1 | undefined): string {
  if (!forecast) return "No forecast yet · run `kuota collect --once`";
  if (forecast.quality === "unsupported") {
    return forecast.reasons.includes("ROLLING_WINDOW_UNMODELED")
      ? "Forecast unavailable · rolling window is not modeled"
      : "Forecast unavailable · window semantics unknown";
  }
  if (forecast.reasons.includes("ALREADY_EXHAUSTED")) return "Quota exhausted";
  if (forecast.quality === "insufficient") return "Collecting data for a forecast…";
  if (forecast.exhaustedAt) {
    return `Est. exhaustion ${forecast.exhaustedAt} · confidence ${forecast.quality}`;
  }
  if (forecast.reasons.includes("STABLE_AT_CURRENT_ACTIVITY")) return "Stable at current activity";
  return `On pace · not expected to exhaust before reset · confidence ${forecast.quality}`;
}

/** Ideal pace is shown only for windows whose fixed cadence is known; never guessed. */
export function windowPace(
  provider: ProviderId,
  window: QuotaWindow,
  now: Date,
): PaceResult | null {
  const profile = windowProfile(provider, window.windowId);
  const reset = window.resetAt ? new Date(window.resetAt) : null;
  const start =
    reset && profile.durationMs !== null ? new Date(reset.getTime() - profile.durationMs) : null;
  return calculatePace({
    now,
    startAt: start,
    resetAt: reset,
    usedPercent: window.usedPercent,
    semantics: profile.semantics,
    startSource: start ? "inferred" : "unknown",
  });
}

/** Cycles through windows, then back to "all" (null). */
export function nextWindow(windowIds: readonly string[], current: string | null): string | null {
  if (windowIds.length === 0) return null;
  if (current === null) return windowIds[0]!;
  const index = windowIds.indexOf(current);
  return index < 0 || index === windowIds.length - 1 ? null : windowIds[index + 1]!;
}

export const seriesKey = (provider: string, windowId: string): string => `${provider}/${windowId}`;
