import { Schema } from "effect";

export const BUILTIN_PROVIDERS = [
  "codex",
  "claude",
  "antigravity",
  "opencodego",
  "openrouter",
  "deepseek",
  "mimo",
  "kimi",
  "glm",
  "minimax",
  "grok",
  "openai",
] as const;

export type BuiltinProviderId = (typeof BUILTIN_PROVIDERS)[number];

export const ProviderIdSchema = Schema.String;
export type ProviderId = string;

export const QuotaStatusSchema = Schema.Literal(
  "ok",
  "partial",
  "unauthenticated",
  "unavailable",
  "unsupported",
  "error",
);
export type QuotaStatus = Schema.Schema.Type<typeof QuotaStatusSchema>;

export const BillingModelSchema = Schema.Literal("subscription", "balance", "hybrid");
export type BillingModel = Schema.Schema.Type<typeof BillingModelSchema>;

export const QuotaWindowSchema = Schema.Struct({
  windowId: Schema.String,
  usedPercent: Schema.NullOr(Schema.Number),
  remainingPercent: Schema.NullOr(Schema.Number),
  resetAt: Schema.NullOr(Schema.String),
});
export type QuotaWindow = Schema.Schema.Type<typeof QuotaWindowSchema>;

export const QuotaBalanceItemSchema = Schema.Struct({
  currency: Schema.String,
  totalBalance: Schema.Number,
  grantedBalance: Schema.optional(Schema.NullOr(Schema.Number)),
  toppedUpBalance: Schema.optional(Schema.NullOr(Schema.Number)),
  usage: Schema.optional(Schema.NullOr(Schema.Number)),
  limit: Schema.optional(Schema.NullOr(Schema.Number)),
  burnRateDaily: Schema.optional(Schema.NullOr(Schema.Number)),
  estimatedDaysLeft: Schema.optional(Schema.NullOr(Schema.Number)),
});
export type QuotaBalanceItem = Schema.Schema.Type<typeof QuotaBalanceItemSchema>;

export const QuotaBalanceSchema = Schema.Struct({
  balances: Schema.Array(QuotaBalanceItemSchema),
  usage: Schema.optional(Schema.NullOr(Schema.Number)),
  limit: Schema.optional(Schema.NullOr(Schema.Number)),
  burnRateDaily: Schema.optional(Schema.NullOr(Schema.Number)),
  estimatedDaysLeft: Schema.optional(Schema.NullOr(Schema.Number)),
});
export type QuotaBalance = Schema.Schema.Type<typeof QuotaBalanceSchema>;

export const QuotaSnapshotSchema = Schema.Struct({
  provider: ProviderIdSchema,
  status: QuotaStatusSchema,
  fetchedAt: Schema.String,
  source: Schema.String,
  billingModel: Schema.optional(BillingModelSchema),
  windows: Schema.Array(QuotaWindowSchema),
  balance: Schema.optional(Schema.NullOr(QuotaBalanceSchema)),
  errorCode: Schema.NullOr(Schema.String),
});
export type QuotaSnapshot = Schema.Schema.Type<typeof QuotaSnapshotSchema>;

export type ProviderErrorCode =
  | "BINARY_NOT_FOUND"
  | "AUTH_REQUIRED"
  | "TIMEOUT"
  | "PROTOCOL_ERROR"
  | "UNSUPPORTED"
  | "UNKNOWN";
