/** A linear *time budget* reference; this is not a statistically inferred forecast. */
export interface PaceInput {
  now: Date;
  startAt: Date | null;
  resetAt: Date | null;
  usedPercent: number | null;
  semantics: "fixed" | "rolling" | "first_use" | "unknown";
  startSource: "provider" | "inferred" | "unknown";
}

export interface PaceResult {
  /** 0 at the window start, 1 at the reset boundary. */
  elapsedFraction: number;
  /** Position of the white tick on a *used* progress bar. */
  idealUsedPercent: number;
  /** Position of the white tick on a *remaining* progress bar. */
  idealRemainingPercent: number;
  actualUsedPercent: number;
  /** Positive means consumption is ahead of linear elapsed-time pace. */
  paceDeltaPoints: number;
  paceRatio: number | null;
  remainingHours: number;
  /** "inferred" is never presented as an exact provider-reported epoch. */
  quality: "exact" | "inferred";
}

/** Returns null when the provider has not proved a comparable fixed window. */
export function calculatePace(input: PaceInput): PaceResult | null {
  if (
    input.semantics === "rolling" ||
    input.semantics === "unknown" ||
    input.startSource === "unknown" ||
    (input.semantics === "first_use" && input.startSource !== "provider") ||
    input.startAt === null ||
    input.resetAt === null ||
    input.usedPercent === null ||
    !Number.isFinite(input.usedPercent) ||
    input.usedPercent < 0 ||
    input.usedPercent > 100
  )
    return null;

  const now = input.now.getTime();
  const start = input.startAt.getTime();
  const reset = input.resetAt.getTime();
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(start) ||
    !Number.isFinite(reset) ||
    reset <= start ||
    now < start
  )
    return null;

  const elapsedFraction = Math.min(1, (now - start) / (reset - start));
  const idealUsedPercent = elapsedFraction * 100;
  return {
    elapsedFraction,
    idealUsedPercent,
    idealRemainingPercent: 100 - idealUsedPercent,
    actualUsedPercent: input.usedPercent,
    paceDeltaPoints: input.usedPercent - idealUsedPercent,
    paceRatio: idealUsedPercent === 0 ? null : input.usedPercent / idealUsedPercent,
    remainingHours: Math.max(0, reset - now) / 3_600_000,
    quality: input.startSource === "provider" ? "exact" : "inferred",
  };
}
