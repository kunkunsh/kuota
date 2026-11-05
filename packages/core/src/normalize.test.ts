import { describe, expect, it } from "vitest";
import { normalizeWindow, redactSnapshot } from "./normalize.js";

describe("normalizeWindow", () => {
  it("turns 40 percent used into 60 percent remaining", () => {
    const window = normalizeWindow({
      windowId: "primary",
      usedPercent: 40,
      resetAt: "2026-11-06T12:00:00Z",
    });
    expect(window.remainingPercent).toBe(60);
    expect(window.usedPercent).toBe(40);
    expect(window.resetAt).toBe("2026-11-06T12:00:00.000Z");
  });

  it("does not turn invalid usage into a fake zero remaining", () => {
    for (const usedPercent of [NaN, 124, -4, Infinity]) {
      const window = normalizeWindow({ windowId: "primary", usedPercent });
      expect(window.remainingPercent).toBeNull();
      expect(window.usedPercent).toBeNull();
    }
  });

  it("does not invent a reset time when source omits it", () => {
    const window = normalizeWindow({ windowId: "weekly", usedPercent: 10 });
    expect(window.resetAt).toBeNull();
  });
});

describe("redactSnapshot", () => {
  it("does not leak token-like keys into public JSON", () => {
    const result = redactSnapshot({
      provider: "codex",
      status: "ok",
      fetchedAt: "2026-11-05T12:00:00Z",
      windows: [],
      accessToken: "secret",
      raw: { cookie: "private" },
    });
    expect(result).toEqual({
      provider: "codex",
      status: "ok",
      fetchedAt: "2026-11-05T12:00:00.000Z",
      source: "unknown",
      windows: [],
      errorCode: null,
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
