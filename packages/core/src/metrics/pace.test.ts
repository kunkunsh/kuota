import { describe, expect, it } from "vitest";
import { calculatePace, type PaceInput } from "./pace.js";

const start = new Date("2026-11-01T00:00:00.000Z");
const end = new Date("2026-11-08T00:00:00.000Z");

const fixed: PaceInput = {
  now: new Date("2026-11-04T12:00:00.000Z"),
  startAt: start,
  resetAt: end,
  usedPercent: 55,
  semantics: "fixed",
  startSource: "provider",
};

describe("calculatePace", () => {
  it("produces the single ideal mark for a seven-day fixed window", () => {
    expect(calculatePace(fixed)).toEqual({
      elapsedFraction: 0.5,
      idealUsedPercent: 50,
      idealRemainingPercent: 50,
      actualUsedPercent: 55,
      paceDeltaPoints: 5,
      paceRatio: 1.1,
      remainingHours: 84,
      quality: "exact",
    });
  });

  it("allows explicitly labeled inferred fixed starts", () => {
    expect(calculatePace({ ...fixed, startSource: "inferred" })?.quality).toBe("inferred");
  });

  it("reports no pace ratio before any of the window has elapsed", () => {
    expect(calculatePace({ ...fixed, now: start, usedPercent: 0 })).toMatchObject({
      elapsedFraction: 0,
      idealUsedPercent: 0,
      paceRatio: null,
      paceDeltaPoints: 0,
    });
  });

  it("clamps the elapsed marker at reset even if observation is delayed", () => {
    expect(
      calculatePace({ ...fixed, now: new Date("2026-11-09T00:00:00Z"), usedPercent: 100 }),
    ).toMatchObject({
      elapsedFraction: 1,
      idealUsedPercent: 100,
      idealRemainingPercent: 0,
      remainingHours: 0,
    });
  });

  it("allows first-use windows only with provider-supplied concrete starts", () => {
    expect(calculatePace({ ...fixed, semantics: "first_use" })?.quality).toBe("exact");
    expect(calculatePace({ ...fixed, semantics: "first_use", startSource: "inferred" })).toBeNull();
  });

  it.each(["rolling", "unknown"] as const)("hides an ideal mark for %s windows", (semantics) => {
    expect(calculatePace({ ...fixed, semantics })).toBeNull();
  });

  it("rejects missing/unknown starts and invalid timestamps", () => {
    expect(calculatePace({ ...fixed, startAt: null })).toBeNull();
    expect(calculatePace({ ...fixed, startSource: "unknown" })).toBeNull();
    expect(calculatePace({ ...fixed, resetAt: start })).toBeNull();
    expect(calculatePace({ ...fixed, now: new Date("2026-10-31T00:00:00Z") })).toBeNull();
    expect(calculatePace({ ...fixed, now: new Date("invalid") })).toBeNull();
  });

  it.each([-1, 101, NaN, Infinity, null])("rejects invalid usedPercent %s", (usedPercent) => {
    expect(calculatePace({ ...fixed, usedPercent })).toBeNull();
  });
});
