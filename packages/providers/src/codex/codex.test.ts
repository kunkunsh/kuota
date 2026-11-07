import { describe, expect, it } from "vitest";
import { parseCodexRateLimits } from "./protocol.js";
import { requestCodexRateLimits } from "./transport.js";

describe("parseCodexRateLimits", () => {
  it("parses the primary and secondary Codex subscription windows", () => {
    const snapshot = parseCodexRateLimits(
      {
        rateLimits: {
          limitId: "codex",
          planType: "pro",
          primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1794000000 },
          secondary: { usedPercent: 55, windowDurationMins: 10080, resetsAt: 1794500000 },
          credits: null,
        },
      },
      new Date("2026-11-05T12:00:00Z"),
    );
    expect(snapshot.provider).toBe("codex");
    expect(snapshot.status).toBe("ok");
    expect(snapshot.source).toBe("codex-app-server");
    expect(snapshot.windows).toEqual([
      {
        windowId: "primary",
        usedPercent: 25,
        remainingPercent: 75,
        resetAt: new Date(1794000000 * 1000).toISOString(),
      },
      {
        windowId: "secondary",
        usedPercent: 55,
        remainingPercent: 45,
        resetAt: new Date(1794500000 * 1000).toISOString(),
      },
    ]);
    expect(snapshot.planType).toBe("pro");
  });

  it("marks malformed percentage partial and unknown, not 0 remaining", () => {
    const snapshot = parseCodexRateLimits({
      rateLimits: { primary: { usedPercent: 135, resetsAt: null }, secondary: null },
    });
    expect(snapshot.status).toBe("partial");
    expect(snapshot.windows).toEqual([
      { windowId: "primary", usedPercent: null, remainingPercent: null, resetAt: null },
    ]);
  });

  it("returns unavailable when the server reports no rate limits", () => {
    const snapshot = parseCodexRateLimits({ rateLimits: null });
    expect(snapshot.status).toBe("unavailable");
    expect(snapshot.windows).toEqual([]);
    expect(snapshot.errorCode).toBe("NO_RATE_LIMITS");
  });

  it("does not infer usable quota when backend explicitly blocks ordinary usage", () => {
    const snapshot = parseCodexRateLimits({
      ordinaryUsageAllowed: false,
      rateLimits: { primary: { usedPercent: 7, resetsAt: null } },
    });
    expect(snapshot.status).toBe("partial");
    expect(snapshot.errorCode).toBe("ORDINARY_USAGE_BLOCKED");
    expect(snapshot.windows[0]?.remainingPercent).toBe(93);
  });
});

describe("requestCodexRateLimits", () => {
  it("initializes JSON-RPC, ignores notifications, and reads only the matching response", async () => {
    const server = [
      "let buffer = '';",
      "process.stdin.on('data', (chunk) => {",
      "  buffer += String(chunk);",
      "  for (;;) { const at = buffer.indexOf('\\n'); if (at < 0) break;",
      "    const line = buffer.slice(0, at); buffer = buffer.slice(at + 1);",
      "    const msg = JSON.parse(line);",
      "    if (msg.method === 'initialize') process.stdout.write(JSON.stringify({ id: msg.id, result: {} }) + '\\n');",
      "    if (msg.method === 'account/rateLimits/read') {",
      "      process.stdout.write(JSON.stringify({ method: 'account/rateLimits/updated', params: {} }) + '\\n');",
      "      process.stdout.write(JSON.stringify({ id: msg.id, result: { rateLimits: { primary: { usedPercent: 23, resetsAt: null } } } }) + '\\n');",
      "    }",
      "  }",
      "});",
    ].join("\n");

    const result = await requestCodexRateLimits({
      binary: process.execPath,
      args: ["-e", server],
      timeoutMs: 5_000,
    });
    expect(result).toEqual({ rateLimits: { primary: { usedPercent: 23, resetsAt: null } } });
  });

  it("times out rather than hanging when the server never responds", async () => {
    await expect(
      requestCodexRateLimits({
        binary: process.execPath,
        args: ["-e", "process.stdin.resume(); setInterval(() => {}, 1000);"],
        timeoutMs: 150,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("returns a typed error for a missing binary without exposing OS internals", async () => {
    await expect(
      requestCodexRateLimits({ binary: "/this/kuota-binary-does-not-exist", timeoutMs: 500 }),
    ).rejects.toMatchObject({ code: "BINARY_NOT_FOUND" });
  });
});
