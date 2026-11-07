import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { defineHttpProvider } from "./adapter.js";
import { opencodegoProvider } from "./opencodego/index.js";
import { openrouterProvider } from "./openrouter/index.js";
import { deepseekProvider } from "./deepseek/index.js";
import { createCustomProvider } from "./custom/index.js";

describe("Provider Adapter Abstraction", () => {
  it("creates a standardized HTTP provider and handles unauthenticated state gracefully", async () => {
    const testProvider = defineHttpProvider({
      id: "test_ai",
      label: "Test AI",
      defaultBillingModel: "balance",
      category: "llm_api",
      envKeys: ["TEST_AI_API_KEY"],
      fetchSnapshot: async () => ({ status: "ok" }),
    });

    const snapshot = await Effect.runPromise(testProvider.read({ env: {} }));
    expect(snapshot.provider).toBe("test_ai");
    expect(snapshot.status).toBe("unauthenticated");
    expect(snapshot.errorCode).toBe("AUTH_REQUIRED");
  });

  it("parses OpenCode Go rolling, weekly, and monthly subscription windows", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          usage: {
            rolling: { percent: 12, resetsAt: "2026-11-08T05:00:00Z" },
            weekly: { percent: 45, resetsAt: "2026-11-10T00:00:00Z" },
            monthly: { percent: 60, resetsAt: "2026-11-30T00:00:00Z" },
          },
        }),
        { status: 200 },
      );

    const snapshot = await Effect.runPromise(
      opencodegoProvider.read({
        apiKey: "test-opencode-key",
        fetch: mockFetch as any,
      }),
    );

    expect(snapshot.provider).toBe("opencodego");
    expect(snapshot.status).toBe("ok");
    expect(snapshot.billingModel).toBe("subscription");
    expect(snapshot.windows).toHaveLength(3);
    expect(snapshot.windows[0]?.windowId).toBe("session.rolling");
    expect(snapshot.windows[0]?.usedPercent).toBe(12);
    expect(snapshot.windows[1]?.windowId).toBe("weekly");
    expect(snapshot.windows[1]?.usedPercent).toBe(45);
    expect(snapshot.windows[2]?.windowId).toBe("monthly");
  });

  it("parses DeepSeek balance payload into typed QuotaBalance items", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          is_available: true,
          balance_infos: [
            {
              currency: "USD",
              total_balance: "18.50",
              granted_balance: "5.00",
              topped_up_balance: "13.50",
            },
            {
              currency: "CNY",
              total_balance: "50.00",
              granted_balance: "0.00",
              topped_up_balance: "50.00",
            },
          ],
        }),
        { status: 200 },
      );

    const snapshot = await Effect.runPromise(
      deepseekProvider.read({
        apiKey: "test-deepseek-key",
        fetch: mockFetch as any,
      }),
    );

    expect(snapshot.provider).toBe("deepseek");
    expect(snapshot.status).toBe("ok");
    expect(snapshot.billingModel).toBe("balance");
    expect(snapshot.balance?.balances).toHaveLength(2);
    expect(snapshot.balance?.balances[0]?.currency).toBe("USD");
    expect(snapshot.balance?.balances[0]?.totalBalance).toBe(18.5);
    expect(snapshot.balance?.balances[0]?.grantedBalance).toBe(5);
    expect(snapshot.balance?.balances[1]?.currency).toBe("CNY");
    expect(snapshot.balance?.balances[1]?.totalBalance).toBe(50);
  });

  it("parses OpenRouter usage, limit, and free tier requests into hybrid snapshot", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          data: {
            usage: 4.5,
            limit: 20.0,
            free_model_daily_requests: { used: 15, limit: 100 },
          },
        }),
        { status: 200 },
      );

    const snapshot = await Effect.runPromise(
      openrouterProvider.read({
        apiKey: "test-openrouter-key",
        fetch: mockFetch as any,
      }),
    );

    expect(snapshot.provider).toBe("openrouter");
    expect(snapshot.status).toBe("ok");
    expect(snapshot.billingModel).toBe("hybrid");
    expect(snapshot.balance?.balances[0]?.totalBalance).toBe(15.5); // 20 - 4.5
    expect(snapshot.balance?.usage).toBe(4.5);
    expect(snapshot.windows[0]?.windowId).toBe("free_tier_daily");
    expect(snapshot.windows[0]?.usedPercent).toBe(15);
  });

  it("supports user-defined custom provider in just a few lines", async () => {
    const custom = createCustomProvider({
      id: "my_custom_llm",
      label: "My Custom LLM",
      baseUrl: "https://my-llm.com/api/balance",
      apiKey: "sk-custom",
      billingModel: "balance",
      currency: "USD",
    });

    const mockFetch = async () =>
      new Response(JSON.stringify({ total_balance: 42.0 }), { status: 200 });

    globalThis.fetch = mockFetch as any;
    const snapshot = await Effect.runPromise(custom.read());
    expect(snapshot.provider).toBe("my_custom_llm");
    expect(snapshot.status).toBe("ok");
    expect(snapshot.balance?.balances[0]?.totalBalance).toBe(42.0);
  });
});
