import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseClaudeOAuthUsage, readClaude, extractClaudeOAuthToken } from "./index.js";

describe("Claude OAuth usage parser", () => {
  it("reads session, weekly and scoped model quota without mixing them", () => {
    const usage = parseClaudeOAuthUsage({
      five_hour: { utilization: 12, resets_at: "2026-11-06T12:00:00Z" },
      seven_day: { utilization: 38 },
      seven_day_sonnet: { utilization: 50 },
      seven_day_opus: { utilization: 63 },
      limits: [
        { kind: "weekly_scoped", percent: 25, scope: { model: { display_name: "Fable" } } },
        { kind: "daily_scoped", percent: 10, scope: { model: { display_name: "Other" } } },
      ],
    });
    expect(
      usage.windows.map(({ windowId, remainingPercent }) => [windowId, remainingPercent]),
    ).toEqual([
      ["session.5h", 88],
      ["weekly.all", 62],
      ["weekly.sonnet", 50],
      ["weekly.opus", 37],
      ["weekly.fable", 75],
    ]);
    expect(usage.windows[0]?.resetAt).toBe("2026-11-06T12:00:00.000Z");
  });

  it("rejects boolean, null or malformed percentages instead of showing 100% remaining", () => {
    const usage = parseClaudeOAuthUsage({
      five_hour: { utilization: null },
      seven_day: { utilization: true },
    });
    expect(usage.windows).toEqual([]);
    expect(usage.status).toBe("unavailable");
    const fallback = parseClaudeOAuthUsage({ seven_day_oauth_apps: { utilization: 71 } });
    expect(fallback.windows[0]?.windowId).toBe("weekly.oauth-apps");
  });

  it("extracts only a valid Claude OAuth access token, not MCP-only keychain state", () => {
    expect(extractClaudeOAuthToken({ mcpOAuth: { accessToken: "mcp" } })).toBeNull();
    expect(
      extractClaudeOAuthToken({
        claudeAiOauth: { accessToken: "test-token", expiresAt: Date.now() + 60000 },
      }),
    ).toBe("test-token");
    expect(
      extractClaudeOAuthToken({
        claudeAiOauth: { accessToken: "expired", expiresAt: Date.now() - 1 },
      }),
    ).toBeNull();
  });
});

describe("Claude OAuth HTTP transport", () => {
  it("uses existing credentials with a bounded read, never returns a token", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kuota-claude-"));
    const credentialsFile = join(dir, "credentials.json");
    try {
      await writeFile(
        credentialsFile,
        JSON.stringify({
          claudeAiOauth: {
            accessToken: "sensitive-test-token",
            expiresAt: Date.now() + 60000,
          },
        }),
        { mode: 0o600 },
      );
      const requests: Array<{ url: string; header: string | null }> = [];
      const fetchImpl: typeof fetch = async (url, init) => {
        const headers = new Headers(init?.headers);
        requests.push({ url: String(url), header: headers.get("Authorization") });
        return new Response(JSON.stringify({ five_hour: { utilization: 21 } }), { status: 200 });
      };
      const result = await Effect.runPromise(readClaude({ credentialsFile, fetchImpl }));
      expect(result.windows[0]?.remainingPercent).toBe(79);
      expect(requests[0]?.url).toBe("https://api.anthropic.com/api/oauth/usage?cedar_ember=1");
      expect(requests[0]?.header).toBe("Bearer sensitive-test-token");
      expect(JSON.stringify(result)).not.toContain("sensitive-test-token");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("classifies missing credentials and unauthorized responses", async () => {
    const noCreds = await Effect.runPromise(
      readClaude({ credentialsFile: "/no/such/kuota-claude-credentials" }),
    );
    expect(noCreds.status).toBe("unauthenticated");
    expect(noCreds.errorCode).toBe("AUTH_REQUIRED");
    const denied = await Effect.runPromise(
      readClaude({ token: "test", fetchImpl: async () => new Response("{}", { status: 401 }) }),
    );
    expect(denied.status).toBe("unauthenticated");
    expect(denied.errorCode).toBe("AUTH_REQUIRED");
  });
});
