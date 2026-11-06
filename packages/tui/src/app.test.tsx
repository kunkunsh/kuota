import { describe, expect, it } from "vitest";
import { MemoryCellSurface, StyleTable, createTuiReactRoot } from "@uniview/tui-react";
import type { QuotaSnapshot } from "@kuota/core";
import { QuotaApp } from "./app.js";
import { ensureInteractiveTerminal } from "./main.js";

const snapshot: QuotaSnapshot = {
  provider: "codex",
  status: "ok",
  fetchedAt: "2026-11-05T12:00:00.000Z",
  source: "codex-app-server",
  windows: [{ windowId: "primary", remainingPercent: 63, usedPercent: 37, resetAt: null }],
  errorCode: null,
};

const settle = async () => {
  for (let i = 0; i < 12; i += 1) await new Promise<void>((resolve) => setTimeout(resolve, 0));
};

describe("UniView QuotaApp", () => {
  it("renders a truthful quota card through the real UniView memory surface", async () => {
    const styles = new StyleTable();
    const surface = new MemoryCellSurface({ styles });
    const root = createTuiReactRoot({ surface, styles, size: { width: 80, height: 24 } });
    root.render(
      <QuotaApp
        snapshots={[snapshot]}
        loading={false}
        onRefresh={() => {}}
        onQuit={() => {}}
        onSelect={() => {}}
      />,
    );
    await settle();
    const text = surface.text({ trimRight: true });
    expect(text).toContain("Kuota");
    expect(text).toContain("Codex");
    expect(text).toContain("63% remaining");
    root.destroy();
  });

  it("maps r and q keys to refresh and quit without conflating them", async () => {
    const styles = new StyleTable();
    const surface = new MemoryCellSurface({ styles });
    const root = createTuiReactRoot({ surface, styles, size: { width: 50, height: 15 } });
    const calls: string[] = [];
    root.render(
      <QuotaApp
        snapshots={[]}
        loading={false}
        onRefresh={() => calls.push("refresh")}
        onQuit={() => calls.push("quit")}
        onSelect={() => {}}
      />,
    );
    await settle();
    root.dispatchInput({ type: "text", text: "r" });
    root.dispatchInput({ type: "text", text: "q" });
    await settle();
    expect(calls).toEqual(["refresh", "quit"]);
    root.destroy();
  });

  it("toggles raw snapshot inspector with s key", async () => {
    const { root, surface } = mount({ snapshots: [snapshot] });
    await settle();
    expect(surface.text({ trimRight: true })).toContain("63% remaining");

    root.dispatchInput({ type: "text", text: "s" });
    await settle();
    const inspected = surface.text({ trimRight: true });
    expect(inspected).toContain("Raw Snapshot Inspector");
    expect(inspected).toContain("source: codex-app-server");
    expect(inspected).toContain("semantics:");

    // Press s again to return
    root.dispatchInput({ type: "text", text: "s" });
    await settle();
    expect(surface.text({ trimRight: true })).toContain("63% remaining");
    root.destroy();
  });

  const mount = (
    props: Partial<React.ComponentProps<typeof QuotaApp>>,
    width = 100,
    height = 30,
  ) => {
    const styles = new StyleTable();
    const surface = new MemoryCellSurface({ styles });
    const root = createTuiReactRoot({ surface, styles, size: { width, height } });
    root.render(
      <QuotaApp
        snapshots={[]}
        loading={false}
        onRefresh={() => {}}
        onQuit={() => {}}
        onSelect={() => {}}
        {...props}
      />,
    );
    return { root, surface };
  };

  it("renders progress bar, ideal pace marker, sparkline and exhaustion estimate", async () => {
    const weekly: QuotaSnapshot = {
      provider: "claude",
      status: "ok",
      fetchedAt: "2026-11-04T12:00:00.000Z",
      source: "t",
      windows: [
        {
          windowId: "weekly.all",
          usedPercent: 50,
          remainingPercent: 50,
          resetAt: "2026-11-08T00:00:00.000Z",
        },
      ],
      errorCode: null,
    };
    const { root, surface } = mount({
      snapshots: [weekly],
      now: new Date("2026-11-04T12:00:00.000Z"),
      series: { "claude/weekly.all": [10, 30, 50] },
      forecasts: [
        {
          schemaVersion: 1,
          provider: "claude",
          windowId: "weekly.all",
          computedAt: "2026-11-04T12:00:00.000Z",
          currentUsedPercent: 50,
          idealUsedPercent: 50,
          observedSpanHours: 80,
          sampleCount: 20,
          slopePercentPerHour: 0.9,
          exhaustedAt: "2026-11-06T00:00:00.000Z",
          projectedUsedAtResetPercent: 100,
          expectedTimeToLimitHours: 36,
          mode: "all-window",
          quality: "medium",
          reasons: [],
        },
      ],
    });
    await settle();
    const text = surface.text({ trimRight: true });
    expect(text).toContain("┃");
    expect(text).toContain("█");
    expect(text).toContain("50% left · ideal 50% left (inferred)");
    expect(text).toContain("trend ▂▃▅");
    expect(text).toContain("Est. exhaustion 2026-11-06T00:00:00.000Z · confidence medium");
    root.destroy();
  });

  it("shows no marker when pace is unproven and no forecast text without forecast data", async () => {
    const agy: QuotaSnapshot = {
      provider: "antigravity",
      status: "ok",
      fetchedAt: "2026-11-04T12:00:00.000Z",
      source: "t",
      windows: [{ windowId: "gemini.quota", usedPercent: 40, remainingPercent: 60, resetAt: null }],
      errorCode: null,
    };
    const { root, surface } = mount({ snapshots: [agy] });
    await settle();
    const text = surface.text({ trimRight: true });
    expect(text).not.toContain("┃");
    expect(text).not.toContain("ideal");
    expect(text).not.toContain("exhaustion");
    root.destroy();
  });

  it("switches provider with p and window with w, and filters windows", async () => {
    const calls: unknown[] = [];
    const snap: QuotaSnapshot = {
      provider: "codex",
      status: "ok",
      fetchedAt: "2026-11-04T12:00:00.000Z",
      source: "t",
      windows: [
        { windowId: "primary", usedPercent: 10, remainingPercent: 90, resetAt: null },
        { windowId: "secondary", usedPercent: 20, remainingPercent: 80, resetAt: null },
      ],
      errorCode: null,
    };
    const { root, surface } = mount({
      snapshots: [snap],
      selected: "codex",
      selectedWindow: "secondary",
      onSelect: (p) => calls.push(["provider", p]),
      onSelectWindow: (w) => calls.push(["window", w]),
    });
    await settle();
    const text = surface.text({ trimRight: true });
    expect(text).toContain("secondary");
    expect(text).not.toContain("primary:");
    root.dispatchInput({ type: "text", text: "p" });
    root.dispatchInput({ type: "text", text: "w" });
    await settle();
    expect(calls).toEqual([
      ["provider", "claude"],
      ["window", null],
    ]);
    root.destroy();
  });

  it("refuses to start a TUI in a non-interactive pipe", () => {
    expect(() => ensureInteractiveTerminal(false, true)).toThrow("interactive terminal");
    expect(() => ensureInteractiveTerminal(true, false)).toThrow("interactive terminal");
    expect(() => ensureInteractiveTerminal(true, true)).not.toThrow();
  });
});
