import { Schema } from "effect";

export const ProviderIdSchema = Schema.Literal("codex", "claude", "antigravity");
export type ProviderId = Schema.Schema.Type<typeof ProviderIdSchema>;

export const QuotaStatusSchema = Schema.Literal(
  "ok",
  "partial",
  "unauthenticated",
  "unavailable",
  "unsupported",
  "error",
);
export type QuotaStatus = Schema.Schema.Type<typeof QuotaStatusSchema>;

export const QuotaWindowSchema = Schema.Struct({
  windowId: Schema.String,
  usedPercent: Schema.NullOr(Schema.Number),
  remainingPercent: Schema.NullOr(Schema.Number),
  resetAt: Schema.NullOr(Schema.String),
});
export type QuotaWindow = Schema.Schema.Type<typeof QuotaWindowSchema>;

export const QuotaSnapshotSchema = Schema.Struct({
  provider: ProviderIdSchema,
  status: QuotaStatusSchema,
  fetchedAt: Schema.String,
  source: Schema.String,
  windows: Schema.Array(QuotaWindowSchema),
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
