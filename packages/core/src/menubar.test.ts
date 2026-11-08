import { describe, expect, it } from "vitest";
import {
  computeTrayTitle,
  detectQuotaAlertEvents,
  formatPromptString,
  type MenuBarDisplayMode,
} from "./menubar.js";
import type { QuotaSnapshot } from "./types.js";

const mockSnapshots: QuotaSnapshot[] = [
  {
    provider: "claude",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    source: "claude-oauth",
    windows: [
      {
        windowId: "weekly.all",
        usedPercent: 45,
        remainingPercent: 55,
      },
    ],
    errorCode: null,
  },
  {
    provider: "mimo",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    source: "mimo-probe",
    windows: [
      {
        windowId: "monthly.plan",
        usedPercent: 92,
        remainingPercent: 8,
      },
    ],
    errorCode: null,
  },
  {
    provider: "openai",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    source: "openai-api",
    windows: [],
    balance: {
      balances: [
        {
          currency: "USD",
          totalBalance: 0,
          usage: 24.07,
        },
      ],
    },
    errorCode: null,
  },
];

describe("computeTrayTitle", () => {
  it("handles icon_only mode by returning empty string", () => {
    expect(computeTrayTitle(mockSnapshots, "icon_only")).toBe("");
  });

  it("handles primary_percent by returning first active provider percentage", () => {
    expect(computeTrayTitle(mockSnapshots, "primary_percent")).toBe("55%");
  });

  it("handles lowest_quota by returning the lowest remaining quota with warning icon", () => {
    expect(computeTrayTitle(mockSnapshots, "lowest_quota")).toBe("⚠️ 8%");
  });

  it("handles wallet_spend by returning aggregated monthly spend", () => {
    expect(computeTrayTitle(mockSnapshots, "wallet_spend")).toBe("$24.07");
  });

  it("handles frontmost_app mode by returning quota for active tool or empty if none", () => {
    expect(computeTrayTitle(mockSnapshots, "frontmost_app", "claude")).toBe("55%");
    expect(computeTrayTitle(mockSnapshots, "frontmost_app", "mimo")).toBe("8%");
    expect(computeTrayTitle(mockSnapshots, "frontmost_app", "unknown-app")).toBe("");
    expect(computeTrayTitle(mockSnapshots, "frontmost_app", null)).toBe("");
  });

  it("handles provider_label by returning short provider name and percent", () => {
    expect(computeTrayTitle(mockSnapshots, "provider_label")).toBe("Claude 55%");
  });
});

describe("detectQuotaAlertEvents", () => {
  it("detects when quota drops below threshold (e.g. 15%)", () => {
    const previous: QuotaSnapshot[] = [
      {
        provider: "claude",
        status: "ok",
        fetchedAt: new Date().toISOString(),
        source: "claude-oauth",
        windows: [{ windowId: "session.5h", usedPercent: 75, remainingPercent: 25 }],
        errorCode: null,
      },
    ];

    const current: QuotaSnapshot[] = [
      {
        provider: "claude",
        status: "ok",
        fetchedAt: new Date().toISOString(),
        source: "claude-oauth",
        windows: [{ windowId: "session.5h", usedPercent: 92, remainingPercent: 8 }],
        errorCode: null,
      },
    ];

    const alerts = detectQuotaAlertEvents(current, previous, 15);
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe("low_quota");
    expect(alerts[0].provider).toBe("claude");
    expect(alerts[0].remainingPercent).toBe(8);
  });

  it("detects when quota resets from low to high", () => {
    const previous: QuotaSnapshot[] = [
      {
        provider: "claude",
        status: "ok",
        fetchedAt: new Date().toISOString(),
        source: "claude-oauth",
        windows: [{ windowId: "weekly.all", usedPercent: 98, remainingPercent: 2 }],
        errorCode: null,
      },
    ];

    const current: QuotaSnapshot[] = [
      {
        provider: "claude",
        status: "ok",
        fetchedAt: new Date().toISOString(),
        source: "claude-oauth",
        windows: [{ windowId: "weekly.all", usedPercent: 0, remainingPercent: 100 }],
        errorCode: null,
      },
    ];

    const alerts = detectQuotaAlertEvents(current, previous, 15);
    expect(alerts.length).toBe(1);
    expect(alerts[0].type).toBe("quota_reset");
    expect(alerts[0].provider).toBe("claude");
    expect(alerts[0].remainingPercent).toBe(100);
  });
});

describe("formatPromptString", () => {
  it("formats prompt in minimal format", () => {
    expect(formatPromptString(mockSnapshots, "minimal")).toBe("55%");
  });

  it("formats prompt in detailed format", () => {
    expect(formatPromptString(mockSnapshots, "detailed")).toBe("[Claude: 55%]");
  });

  it("formats prompt in starship format with nerd font icon", () => {
    expect(formatPromptString(mockSnapshots, "starship")).toBe("󰚩 55%");
  });

  it("formats exhausted status cleanly", () => {
    const exhaustedSnapshot: QuotaSnapshot[] = [
      {
        provider: "claude",
        status: "ok",
        fetchedAt: new Date().toISOString(),
        source: "claude-oauth",
        windows: [{ windowId: "session.5h", usedPercent: 100, remainingPercent: 0 }],
        errorCode: "QUOTA_EXHAUSTED",
      },
    ];
    expect(formatPromptString(exhaustedSnapshot, "minimal")).toBe("⚠️ 0%");
    expect(formatPromptString(exhaustedSnapshot, "detailed")).toBe("[Claude: EXHAUSTED]");
    expect(formatPromptString(exhaustedSnapshot, "starship")).toBe("󰚩 ⚠️ 0%");
  });
});
