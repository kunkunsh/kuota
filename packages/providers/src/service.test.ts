import { Effect } from "effect";
import type { ProviderId, QuotaSnapshot } from "@kuota/core";
import { describe, expect, it } from "vitest";
import type { QuotaProvider } from "./registry.js";
import { createQuotaService } from "./service.js";

const iso = (ms: number) => new Date(ms).toISOString();

function harness() {
  let now = Date.parse("2026-11-06T00:00:00Z");
  let calls = 0;
  let next: () => Effect.Effect<QuotaSnapshot, unknown>;
  const ok = (): Effect.Effect<QuotaSnapshot, unknown> =>
    Effect.sync(() => ({
      provider: "codex" as ProviderId,
      status: "ok" as const,
      fetchedAt: iso(now),
      source: "t",
      windows: [{ windowId: "5h", usedPercent: 10, remainingPercent: 90, resetAt: null }],
      errorCode: null,
    }));
  const fail = (errorCode: string, status: QuotaSnapshot["status"] = "unavailable") =>
    Effect.sync((): QuotaSnapshot => ({
      provider: "codex",
      status,
      fetchedAt: iso(now),
      source: "t",
      windows: [],
      errorCode,
    }));
  next = ok;
  const provider: QuotaProvider = {
    id: "codex",
    label: "Codex",
    read: () => {
      calls++;
      return Effect.promise(() => Promise.resolve()).pipe(Effect.zipRight(next()));
    },
  };
  const service = createQuotaService({ providers: [provider], now: () => now });
  return {
    service,
    ok,
    fail,
    setNext: (f: typeof next) => (next = f),
    advance: (ms: number) => (now += ms),
    calls: () => calls,
  };
}

const read = (h: ReturnType<typeof harness>, force = false) =>
  Effect.runPromise(h.service.read(["codex"], { force }));

describe("createQuotaService", () => {
  it("singleflights concurrent reads and honours TTL", async () => {
    const h = harness();
    const [a, b] = await Promise.all([read(h), read(h)]);
    expect(h.calls()).toBe(1);
    expect(a[0]!.freshness).toBe("live");
    expect(b[0]!.freshness).toBe("live");
    h.advance(30_000);
    const c = await read(h);
    expect(h.calls()).toBe(1);
    expect(c[0]!.freshness).toBe("cached");
    expect(c[0]!.ageMs).toBe(30_000);
    h.advance(30_000);
    const d = await read(h);
    expect(h.calls()).toBe(2);
    expect(d[0]!.freshness).toBe("live");
  });

  it("force bypasses TTL", async () => {
    const h = harness();
    await read(h);
    await read(h, true);
    expect(h.calls()).toBe(2);
  });

  it("429 keeps last good data as stale and enforces cooldown, even when forced", async () => {
    const h = harness();
    await read(h);
    h.advance(61_000);
    h.setNext(() => h.fail("RATE_LIMITED"));
    const s = await read(h);
    expect(h.calls()).toBe(2);
    expect(s[0]!.freshness).toBe("stale");
    expect(s[0]!.snapshot.status).toBe("ok");
    expect(s[0]!.latestErrorCode).toBe("RATE_LIMITED");
    expect(s[0]!.nextAttemptAt).toBe(iso(Date.parse("2026-11-06T00:01:01Z") + 900_000));
    h.advance(120_000);
    const again = await read(h, true);
    expect(h.calls()).toBe(2);
    expect(again[0]!.freshness).toBe("stale");
    h.advance(900_000);
    h.setNext(h.ok);
    const recovered = await read(h);
    expect(h.calls()).toBe(3);
    expect(recovered[0]!.freshness).toBe("live");
  });

  it("generic failure retains stale data with 60s retry, dropped after staleMaxAge", async () => {
    const h = harness();
    await read(h);
    h.advance(61_000);
    h.setNext(() => h.fail("TIMEOUT"));
    const s = await read(h);
    expect(s[0]!.freshness).toBe("stale");
    h.advance(30_000);
    await read(h);
    expect(h.calls()).toBe(2);
    h.advance(86_400_000);
    const gone = await read(h);
    expect(gone[0]!.snapshot.status).toBe("unavailable");
    expect(gone[0]!.snapshot.errorCode).toBe("TIMEOUT");
  });

  it("auth failure clears last good data so another account is never shown", async () => {
    const h = harness();
    await read(h);
    h.advance(61_000);
    h.setNext(() => h.fail("AUTH_REQUIRED", "unauthenticated"));
    const s = await read(h);
    expect(s[0]!.snapshot.status).toBe("unauthenticated");
    expect(s[0]!.snapshot.windows).toEqual([]);
    h.advance(10_000);
    await read(h);
    expect(h.calls()).toBe(2);
  });

  it("isolates thrown/defecting providers and unregistered ids", async () => {
    const h = harness();
    h.setNext(() => Effect.die(new Error("secret-token boom")));
    const [o] = await read(h);
    expect(o!.snapshot.status).toBe("unavailable");
    expect(o!.snapshot.errorCode).toBe("PROVIDER_FAILED");
    expect(JSON.stringify(o)).not.toContain("secret-token");
    const res = await Effect.runPromise(h.service.read(["claude"]));
    expect(res[0]!.snapshot.status).toBe("unsupported");
  });

  it("invalidate drops cache and prevents an old inflight read from restoring data", async () => {
    const h = harness();
    await read(h);
    h.service.invalidate("codex");
    expect(h.service.peek("codex")).toBeNull();
    await read(h);
    expect(h.calls()).toBe(2);
  });
});
