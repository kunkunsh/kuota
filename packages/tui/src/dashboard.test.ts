import { describe, expect, it } from "vitest";
import type { QuotaForecastV1 } from "@kuota/core";
import {
  barCells,
  describeExhaustion,
  nextWindow,
  seriesKey,
  sparkline,
  windowPace,
} from "./dashboard.js";

const forecast = (over: Partial<QuotaForecastV1> = {}): QuotaForecastV1 => ({
  schemaVersion: 1,
  provider: "claude",
  windowId: "weekly.all",
  computedAt: "2026-11-04T12:00:00.000Z",
  currentUsedPercent: 50,
  idealUsedPercent: 50,
  observedSpanHours: 80,
  sampleCount: 20,
  slopePercentPerHour: 0.6,
  exhaustedAt: null,
  projectedUsedAtResetPercent: 60,
  expectedTimeToLimitHours: null,
  mode: "all-window",
  quality: "medium",
  reasons: [],
  ...over,
});

describe("sparkline", () => {
  it("maps percentages onto an absolute 0-100 scale and keeps the newest width values", () => {
    expect(sparkline([0, 50, 100], 8)).toBe("▁▅█");
    expect(sparkline([0, 0, 0, 100], 2)).toBe("▁█");
    expect(sparkline([], 8)).toBe("");
  });
  it("ignores non-finite values", () => {
    expect(sparkline([10, Number.NaN, 90], 8)).toBe("▂▇");
  });
});

describe("barCells", () => {
  it("fills proportionally and places a single marker at the ideal pace", () => {
    const cells = barCells(50, 25, 20);
    expect(cells).toHaveLength(20);
    expect(cells.filter((c) => c === "marker")).toHaveLength(1);
    expect(cells.indexOf("marker")).toBe(5);
    expect(cells.filter((c) => c === "fill").length).toBeGreaterThanOrEqual(9);
  });
  it("omits the marker when ideal pace is unknown", () => {
    expect(barCells(30, null, 10)).not.toContain("marker");
  });
  it("clamps out-of-range values", () => {
    expect(barCells(150, 150, 10)).toHaveLength(10);
    expect(barCells(-5, -5, 10)[0]).toBe("marker");
  });
});

describe("describeExhaustion", () => {
  it("covers every honest state", () => {
    expect(describeExhaustion(undefined)).toBe("No forecast yet · run `kuota collect --once`");
    expect(
      describeExhaustion(
        forecast({ quality: "unsupported", reasons: ["ROLLING_WINDOW_UNMODELED"] }),
      ),
    ).toMatch(/rolling/i);
    expect(
      describeExhaustion(
        forecast({ quality: "unsupported", reasons: ["WINDOW_SEMANTICS_UNKNOWN"] }),
      ),
    ).toMatch(/unknown/i);
    expect(describeExhaustion(forecast({ quality: "insufficient" }))).toMatch(/collecting/i);
    expect(describeExhaustion(forecast({ exhaustedAt: "2026-11-06T14:00:00.000Z" }))).toBe(
      "Est. exhaustion 2026-11-06T14:00:00.000Z · confidence medium",
    );
    expect(describeExhaustion(forecast({ reasons: ["ON_PACE"] }))).toMatch(/on pace/i);
    expect(describeExhaustion(forecast({ reasons: ["STABLE_AT_CURRENT_ACTIVITY"] }))).toMatch(
      /stable/i,
    );
    expect(
      describeExhaustion(
        forecast({ reasons: ["ALREADY_EXHAUSTED"], exhaustedAt: "2026-11-04T00:00:00.000Z" }),
      ),
    ).toMatch(/exhausted/i);
  });
});

describe("windowPace / nextWindow / seriesKey", () => {
  it("computes ideal pace only for windows proven fixed", () => {
    const now = new Date("2026-11-04T12:00:00.000Z");
    const pace = windowPace(
      "claude",
      {
        windowId: "weekly.all",
        usedPercent: 50,
        remainingPercent: 50,
        resetAt: "2026-11-08T00:00:00.000Z",
      },
      now,
    );
    expect(pace?.idealUsedPercent).toBeCloseTo(50, 3);
    expect(
      windowPace(
        "antigravity",
        { windowId: "gemini.quota", usedPercent: 5, remainingPercent: 95, resetAt: null },
        now,
      ),
    ).toBeNull();
  });
  it("cycles windows and wraps", () => {
    expect(nextWindow(["a", "b"], null)).toBe("a");
    expect(nextWindow(["a", "b"], "a")).toBe("b");
    expect(nextWindow(["a", "b"], "b")).toBeNull();
    expect(nextWindow([], null)).toBeNull();
  });
  it("builds stable series keys", () => {
    expect(seriesKey("codex", "primary")).toBe("codex/primary");
  });
});
