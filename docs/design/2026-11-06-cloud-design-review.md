# Kuota cloud design review (Phase 6) — review only, nothing deployed

Date: 2026-11-06. No Cloudflare resource, account, token or network call was created or made. No real usage data leaves the machine. Deployment and any upload need HK's explicit approval.

Inputs: `docs/specs/2026-11-06-kuota-history-cloud-spec.md` §5–§8, `docs/research/2026-11-06-kuota-telemetry-cost-research.md`.

## Proposed architecture (from spec)

Cloudflare Worker (ingest + query) → D1 (recent, per-user rows) → nightly archive of closed days to R2 (`archive/private/user=<opaque>/date=YYYY-MM-DD/part-<batch>.jsonl.gz`) → daily aggregates; DuckDB/Parquet only for offline research queries.

## Alignment with what is implemented locally

| Cloud need | Local building block (done) | Gap |
| --- | --- | --- |
| Idempotent upload | `eventId` = sha256 of safe metadata (`@kuota/core` `history/schema.ts`) | Worker must re-validate with the same strict schema |
| No secrets in payload | Strict decode rejects unknown fields | Add server-side size and rate limits |
| Day partitions | JSONL partitions per UTC day | Upload cursor/manifest per day not implemented |
| Epoch-safe analytics | `epochId`, `semantics`, `detectEpochs` | Rolling windows must stay excluded from research aggregates |

## Risks and required decisions before any build

1. **Two consents, two pipelines.** Private Sync (own data, per-user key) and Anonymous Research (aggregated, k-anonymous) must be separate opt-ins, separate endpoints and separate storage. Never derive research IDs from email/token hashes.
2. **Re-identification.** `accountScope`, `deviceId`, exact `observedAt` and resets are quasi-identifiers. Research export should drop both IDs and bucket time (hour), publish only cohorts with a minimum size (Gallery H7 requires k ≥ 50; benchmarks stay hidden until opt-in, k-suppression, normalization and backtests are proven).
3. **Auth.** Per-device credential issuance, rotation and revocation are undefined. Needs a design (not shared static key).
4. **Account identity.** Local journal uses `accountScope = null` because no provider proves identity without reading secrets. Cloud cohorts would mix accounts; resolve before research use.
5. **Deletion.** Right-to-delete must cover D1 rows and R2 archives (per-user prefix makes this feasible). Archive immutability vs deletion needs a tombstone design.
6. **Cost and abuse.** Per-user write quota, payload size cap, batch idempotency keys; D1 row growth estimate must be redone with real event volume (~windows × samples/day).
7. **Honest forecasts.** Server-side forecasts must reuse `@kuota/core`; any calibration claims require backtests first.

Gallery QA constraints carried over: private sync and research are two independent channels from local storage (research never depends on private sync); pick one retention value backed by a saved setting (hot D1 = 14d per H6); do not claim cloud encryption until implemented; effective token allowance is never shown as an official cap.

## Gates (all require HK approval)

- G1: approve data contract and consent texts.
- G2: approve auth and key-management design.
- G3: approve cost estimate and a staging account.
- G4: only then create Workers/D1/R2 in staging; first upload uses synthetic data.
