/**
 * @kunkun.sh/kuota
 *
 * Truthful multi-provider AI quota monitoring, forecasting, and parsing library.
 * Supports OpenAI Codex, Anthropic Claude Code, and Google Antigravity.
 */

// 1. Data Parsers
export * from "./parsers.js";

// 2. Metrics & Forecasting
export * from "./metrics.js";

// 3. History Journaling
export * from "./history.js";

// 4. Live Providers & Service
export * from "./providers.js";

// 5. Types & Schemas
export {
  ProviderIdSchema,
  QuotaStatusSchema,
  QuotaWindowSchema,
  QuotaSnapshotSchema,
  QuotaHistoryEventV1Schema,
  type ProviderId,
  type QuotaStatus,
  type QuotaWindow,
  type QuotaSnapshot,
  type QuotaHistoryEventV1,
  type ProviderErrorCode,
} from "../../core/src/index.js";
