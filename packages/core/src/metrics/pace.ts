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

export interface WindowPaceTarget {
  windowId: string;
  resetAt?: string | null;
  remainingPercent?: number | null;
  usedPercent?: number | null;
}

/**
 * Universal linear pacing calculator for any window with a deadline/reset timestamp.
 * Infers cycle duration (monthly, weekly, daily, 5-hour) from window semantics and deadline.
 */
export function resolveIdealPace(
  win: WindowPaceTarget,
  provider = "",
  now = new Date(),
): {
  idealRemainingPercent: number;
  idealUsedPercent: number;
  quality: "exact" | "inferred";
  paceStatus: "ahead" | "on_pace" | "behind";
} | null {
  if (!win.resetAt) return null;
  const resetMs = new Date(win.resetAt).getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(resetMs) || resetMs <= nowMs) {
    return {
      idealRemainingPercent: 0,
      idealUsedPercent: 100,
      quality: "exact",
      paceStatus: "behind",
    };
  }

  const remainingMs = resetMs - nowMs;
  const id = win.windowId.toLowerCase();

  // Determine window cycle duration
  let durationMs: number;
  if (
    id.includes("month") ||
    id.includes("30d") ||
    id.includes("token_plan") ||
    id.includes("token-plan")
  ) {
    durationMs = 30 * 24 * 3_600_000;
  } else if (id.includes("week") || id.includes("7d") || id.includes("weekly")) {
    durationMs = 7 * 24 * 3_600_000;
  } else if (
    id.includes("5h") ||
    id.includes("session") ||
    (id === "primary" && remainingMs <= 5.5 * 3_600_000)
  ) {
    durationMs = 5 * 3_600_000;
  } else if (id.includes("day") || id.includes("daily") || id.includes("24h")) {
    durationMs = 24 * 3_600_000;
  } else if (remainingMs > 8 * 24 * 3_600_000) {
    durationMs = 30 * 24 * 3_600_000;
  } else if (remainingMs > 24 * 3_600_000) {
    durationMs = 7 * 24 * 3_600_000;
  } else if (remainingMs > 5 * 3_600_000) {
    durationMs = 24 * 3_600_000;
  } else {
    durationMs = 5 * 3_600_000;
  }

  if (durationMs < remainingMs) {
    durationMs = remainingMs;
  }

  const elapsedMs = durationMs - remainingMs;
  const elapsedFraction = Math.max(0, Math.min(1, elapsedMs / durationMs));
  const idealUsedPercent = elapsedFraction * 100;
  const idealRemainingPercent = 100 - idealUsedPercent;

  const remaining =
    win.remainingPercent != null
      ? win.remainingPercent
      : win.usedPercent != null
        ? 100 - win.usedPercent
        : null;

  let paceStatus: "ahead" | "on_pace" | "behind" = "on_pace";
  if (remaining != null) {
    const delta = remaining - idealRemainingPercent;
    if (delta > 5) paceStatus = "ahead";
    else if (delta < -5) paceStatus = "behind";
  }

  return {
    idealRemainingPercent,
    idealUsedPercent,
    quality: "inferred",
    paceStatus,
  };
}
