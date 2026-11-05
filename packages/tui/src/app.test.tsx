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

  it("refuses to start a TUI in a non-interactive pipe", () => {
    expect(() => ensureInteractiveTerminal(false, true)).toThrow("interactive terminal");
    expect(() => ensureInteractiveTerminal(true, false)).toThrow("interactive terminal");
    expect(() => ensureInteractiveTerminal(true, true)).not.toThrow();
  });
});
