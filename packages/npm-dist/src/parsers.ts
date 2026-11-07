import {
  parseCodexRateLimits,
  parseClaudeOAuthUsage,
  parseAntigravityUsageReport,
  parseAgyVersion,
} from "../../providers/src/index.js";
import {
  type ProviderId,
  type QuotaSnapshot,
  makeUnavailableSnapshot,
} from "../../core/src/index.js";

export {
  parseCodexRateLimits,
  parseClaudeOAuthUsage,
  parseAntigravityUsageReport,
  parseAgyVersion,
};

/**
 * High-level unified dispatcher that parses raw vendor quota responses into
 * truthful, normalized QuotaSnapshot data structures.
 *
 * @param provider "codex" | "claude" | "antigravity"
 * @param raw Raw JSON or RPC response object received from upstream provider
 * @param fetchedAt Optional fetch timestamp (defaults to current time)
 * @returns Fully validated and normalized QuotaSnapshot
 */
export function parseProviderQuota(
  provider: ProviderId,
  raw: unknown,
  fetchedAt = new Date(),
): QuotaSnapshot {
  switch (provider) {
    case "codex":
      return parseCodexRateLimits(raw, fetchedAt);
    case "claude":
      return parseClaudeOAuthUsage(raw);
    case "antigravity":
      return parseAntigravityUsageReport(raw);
    default:
      return makeUnavailableSnapshot(provider, "UNSUPPORTED_PROVIDER", "unsupported");
  }
}
