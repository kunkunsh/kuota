import { describe, expect, it } from "vitest";
import { makeObservation } from "./observation.js";
import type { QuotaSnapshot } from "./types.js";

const T0 = Date.parse("2026-11-06T00:00:00.000Z");
const snap = (fetchedAt = new Date(T0).toISOString()): QuotaSnapshot => ({
  provider: "codex",
  status: "ok",
  fetchedAt,
  source: "test",
  windows: [],
  errorCode: null,
});

describe("makeObservation", () => {
  it("live observation has zero age", () => {
    const o = makeObservation({ snapshot: snap(), freshness: "live", checkedAtMs: T0, nowMs: T0 });
    expect(o.ageMs).toBe(0);
    expect(o.observedAt).toBe(new Date(T0).toISOString());
    expect(o.nextAttemptAt).toBeNull();
    expect(o.latestErrorCode).toBeNull();
  });

  it("cached observation reports age", () => {
    const o = makeObservation({
      snapshot: snap(),
      freshness: "cached",
      checkedAtMs: T0,
      nowMs: T0 + 61_000,
    });
    expect(o.ageMs).toBe(61_000);
    expect(o.freshness).toBe("cached");
  });

  it("stale observation keeps error and next attempt", () => {
    const o = makeObservation({
      snapshot: snap(),
      freshness: "stale",
      checkedAtMs: T0 + 1000,
      nowMs: T0 + 5000,
      nextAttemptAtMs: T0 + 900_000,
      latestErrorCode: "RATE_LIMITED",
    });
    expect(o.latestErrorCode).toBe("RATE_LIMITED");
    expect(o.nextAttemptAt).toBe(new Date(T0 + 900_000).toISOString());
    expect(o.checkedAt).toBe(new Date(T0 + 1000).toISOString());
    expect(o.ageMs).toBe(5000);
  });

  it("clamps negative clock skew to zero", () => {
    const o = makeObservation({
      snapshot: snap(),
      freshness: "cached",
      checkedAtMs: T0,
      nowMs: T0 - 10_000,
    });
    expect(o.ageMs).toBe(0);
  });

  it("never exposes an invalid fetchedAt timestamp", () => {
    const o = makeObservation({
      snapshot: snap("garbage"),
      freshness: "live",
      checkedAtMs: T0,
      nowMs: T0 + 2000,
    });
    expect(o.observedAt).toBe(new Date(T0).toISOString());
    expect(Number.isFinite(o.ageMs)).toBe(true);
    expect(o.ageMs).toBe(2000);
  });

  it("does not mutate the input snapshot", () => {
    const s = Object.freeze(snap());
    const o = makeObservation({ snapshot: s, freshness: "live", checkedAtMs: T0, nowMs: T0 });
    expect(o.snapshot).toBe(s);
  });
});
