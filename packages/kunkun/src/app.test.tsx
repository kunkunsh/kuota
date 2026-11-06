import * as React from "react";
import { describe, expect, it } from "vitest";
import { KuotaDashboard } from "./app.js";
import { PacedProgress } from "./components/paced-progress.js";
import { IslandView } from "./components/views/island-view.js";
import { DataSyncView } from "./components/views/data-sync-view.js";
import { BenchmarksView } from "./components/views/benchmarks-view.js";
import { OverviewView } from "./components/views/overview-view.js";
import { HistoryView } from "./components/views/history-view.js";

describe("PacedProgress Component", () => {
  it("creates a progressbar element with remaining balance and ideal pace props", () => {
    const el = <PacedProgress remainingPercent={42} idealRemainingPercent={45} quality="exact" />;
    expect(React.isValidElement(el)).toBe(true);
    expect(el.props.remainingPercent).toBe(42);
    expect(el.props.idealRemainingPercent).toBe(45);
    expect(el.props.quality).toBe("exact");

    const rendered = PacedProgress({
      remainingPercent: 42,
      idealRemainingPercent: 45,
      quality: "exact",
    });
    expect(React.isValidElement(rendered)).toBe(true);

    const [barContainer] = React.Children.toArray(rendered.props.children) as React.ReactElement<
      Record<string, unknown>
    >[];
    expect(barContainer?.props?.["role"]).toBe("progressbar");
    expect(barContainer?.props?.["aria-valuenow"]).toBe(42);
    expect(barContainer?.props?.["aria-description"]).toContain(
      "Ideal time-based pace is 45.0% remaining (exact)",
    );

    // Exactly one white tick marker in barContainer children
    const barChildren = React.Children.toArray(
      barContainer?.props?.children as React.ReactNode,
    ) as React.ReactElement<Record<string, unknown>>[];
    const marker = barChildren.find((c) => String(c?.props?.className ?? "").includes("bg-white"));
    expect(marker).toBeDefined();
    expect((marker?.props?.style as Record<string, unknown>)?.left).toBe("45%");
  });

  it("omits the white tick marker when idealRemainingPercent is null (rolling or unproven)", () => {
    const rendered = PacedProgress({
      remainingPercent: 60,
      idealRemainingPercent: null,
    });
    const [barContainer] = React.Children.toArray(rendered.props.children) as React.ReactElement<
      Record<string, unknown>
    >[];
    expect(barContainer?.props?.["aria-valuenow"]).toBe(60);
    expect(barContainer?.props?.["aria-description"]).toContain("unproven or rolling");

    const barChildren = React.Children.toArray(
      barContainer?.props?.children as React.ReactNode,
    ) as React.ReactElement<Record<string, unknown>>[];
    const marker = barChildren.find((c) => String(c?.props?.className ?? "").includes("bg-white"));
    expect(marker).toBeUndefined();
  });
});

describe("KuotaDashboard App & Views", () => {
  it("creates valid React element for KuotaDashboard", () => {
    const el = <KuotaDashboard initialRoute="overview" />;
    expect(React.isValidElement(el)).toBe(true);
    expect(el.props.initialRoute).toBe("overview");
  });

  it("OverviewView displays provider cards without summing percentages into a global aggregate", () => {
    const snapshots = [
      {
        provider: "codex" as const,
        status: "ok" as const,
        fetchedAt: "2026-11-06T00:00:00.000Z",
        source: "codex-app-server",
        windows: [{ windowId: "primary", usedPercent: 40, remainingPercent: 60, resetAt: null }],
        errorCode: null,
      },
      {
        provider: "claude" as const,
        status: "ok" as const,
        fetchedAt: "2026-11-06T00:00:00.000Z",
        source: "claude-oauth-usage",
        windows: [{ windowId: "weekly.all", usedPercent: 50, remainingPercent: 50, resetAt: null }],
        errorCode: null,
      },
    ];

    const rendered = OverviewView({ snapshots });
    expect(React.isValidElement(rendered)).toBe(true);
    const children = React.Children.toArray(rendered.props.children) as React.ReactElement<
      Record<string, unknown>
    >[];
    // Provider cards grid is the 3rd child (index 2)
    const providerGrid = children[2];
    const cards = React.Children.toArray(providerGrid?.props?.children as React.ReactNode);
    expect(cards).toHaveLength(2);
  });

  it("creates valid React element for DataSyncView", () => {
    const el = <DataSyncView />;
    expect(React.isValidElement(el)).toBe(true);
  });

  it("BenchmarksView enforces k ≥ 50 anonymity notice per Gallery QA", () => {
    const rendered = BenchmarksView();
    expect(React.isValidElement(rendered)).toBe(true);
    const children = React.Children.toArray(rendered.props.children) as React.ReactElement<
      Record<string, unknown>
    >[];
    const header = children[0] as React.ReactElement;
    expect(JSON.stringify(header.props)).toContain("k ≥ 50 Anonymity");
    const notice = children.find((c) =>
      String(c?.props?.className ?? "").includes("rounded-lg border"),
    );
    expect(notice).toBeDefined();
    expect(JSON.stringify(notice?.props)).toContain("at least 50 independent subscribers");
  });

  it("HistoryView renders forecast hero and raw snapshot inspector table", () => {
    const events: any[] = [
      {
        schemaVersion: 1,
        eventId: "event-1234567890abcdef",
        kind: "quota_observed",
        recordedAt: "2026-11-06T10:00:00.000Z",
        fetchedAt: "2026-11-06T10:00:00.000Z",
        sourceFreshness: "live",
        deviceId: "test-dev",
        accountScope: null,
        provider: "claude",
        windowId: "weekly",
        usedPercent: 55,
        remainingPercent: 45,
        resetAt: "2026-11-12T00:00:00.000Z",
        rawSourceName: "test",
      },
    ];
    const rendered = HistoryView({ events });
    expect(React.isValidElement(rendered)).toBe(true);
    const text = JSON.stringify(rendered.props);
    expect(text).toContain("Quota Usage — History & Forecast");
    expect(text).toContain("Raw Snapshot Logs & Inspector");
    expect(text).toContain("event-1234567890abcdef");
  });

  it("IslandView creates compact widget with exactly one white tick per provider row", () => {
    const snapshots = [
      {
        provider: "claude" as const,
        status: "ok" as const,
        fetchedAt: "2026-11-06T00:00:00.000Z",
        source: "claude-oauth-usage",
        windows: [
          {
            windowId: "weekly.all",
            usedPercent: 40,
            remainingPercent: 60,
            resetAt: "2026-11-10T00:00:00.000Z",
          },
        ],
        errorCode: null,
      },
    ];

    const rendered = IslandView({ snapshots });
    expect(React.isValidElement(rendered)).toBe(true);
    expect(rendered.props.className).toContain("max-w-[420px]");
  });
});
