# Kuota Telemetry / Forecast / Cloud Storage Research and Cost Model

> 2026-11-06 (Toronto) · Research from official docs + engineering estimates. **No cloud deployment, paid service or telemetry ingestion was created.**  
> Pricing in USD, Cloudflare public self-serve prices as viewed 2026-11-06; re-check before launch. Calculations assume the Kunkun Cloud account's included quotas are _not consumed by other applications_. HK's existing apps share those limits, so actual incremental bills may be higher.

## 1. Answer first

**Yes, worthwhile.** A local quota pacing marker and forecast add significant decision value at modest engineering effort. The low-risk product is an open, local-first CLI/library/TUI plus Kunkun UI; historical charts and optional sync build naturally on it. **No hosted OLAP database is justified initially.** Largest costs/risks are changing provider quotas, identity-safe dedup, preserving history during D1→R2 archive, data privacy and customer trust—not raw disk storage.

**Do not require free users to transfer telemetry as the price of privacy.** The raw amounts are small; coercive telemetry damages credibility for a tool that already sees local AI account state. Offer an optional research contribution and a premium cloud-UX bundle instead.

## 2. Cloudflare official price inputs

| Product              | Included / free reference                                                                                                 | Paid marginal price                                                                | Source                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Workers Standard     | Paid account minimum **$5/month**; **10M requests/month** + **30M CPU-ms/month** included; free workers 100k requests/day | $0.30 / 1M extra requests; $0.02 / 1M extra CPU-ms; no bill for idle wall-time     | [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| D1 reads             | Paid **25B rows read/month included**, Free 5M/day                                                                        | $0.001 / 1M additional rows read                                                   | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)                      |
| D1 writes            | Paid **50M rows written/month included**, Free 100k/day                                                                   | $1 / 1M additional rows written; indexes and DELETE/UPDATE can add counted writes  | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)                      |
| D1 storage           | Paid first **5GB** included (Free 5GB total but lower per-db max)                                                         | $0.75 / additional GB-month                                                        | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)                      |
| D1 database max      | **10GB per DB paid**, **500MB per DB free**; paid total storage max 1TB account subject to limits                         | Shard or compact before single-db limit                                            | [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)                        |
| R2 Standard          | First **10GB-month**, **1M Class A** and **10M Class B** operations/month included                                        | $0.015 / GB-month, PUT Class A $4.50 / 1M, GET Class B $0.36 / 1M; **egress free** | [R2 pricing](https://developers.cloudflare.com/r2/pricing/)                               |
| R2 Infrequent Access | Different price category, minimum storage duration, retrieval fees                                                        | $0.01 / GB-month, $0.01 / GB retrieval + requests                                  | [R2 storage classes](https://developers.cloudflare.com/r2/buckets/storage-classes/)       |
| Cron Triggers        | Worker `scheduled()` runs on Cloudflare, not users' machines                                                              | Part of Workers execution billing                                                  | [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)   |
| R2 read-after-write  | Strong consistency, but concurrent PUT/DELETE to same key: **last completion wins**                                       | Never model JSONL as remotely appendable                                           | [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/)             |

Workers Paid is **$5 minimum per account** (not $5 for every Kuota application). D1's index row writes and deleting hot rows matter in usage estimates; Workers CPU is nonzero for JSON validation, auth, D1 writes and aggregations. Cloud storage/account plans are shared with other services. Billing rounds operations, so estimates below are not invoices.

## 3. Transparent volume assumptions

Base-case one active device per subscriber, 24h/day × 30 days, **one combined 1KB snapshot payload per hour** containing all current provider windows (NOT one HTTP call per provider). Approximately 720 observations per user-month and 336 in a 14-day hot window. Other devices multiply collection; a 10m/15m interval multiplies requests by 6/4; 3 separate provider uploads/h instead of one batch triples requests. `1KB` is an _illustrative persisted-envelope payload_, not a measured actual Kuota schema size. D1 SQLite overhead, indexes, archive manifests, request headers and retries are not inside that 1KB.

| Active users | Combined cloud writes / month | Ingest requests / day | 1KB raw payload / month | 14-day hot D1 raw payload | 1-year raw if all retained |
| -----------: | ----------------------------: | --------------------: | ----------------------: | ------------------------: | -------------------------: |
|          100 |                        72,000 |                 2,400 |                    72MB |                    33.6MB |                    0.864GB |
|        1,000 |                       720,000 |                24,000 |                   720MB |                     336MB |                     8.64GB |
|       10,000 |                     7,200,000 |               240,000 |                   7.2GB |                    3.36GB |                     86.4GB |
|      100,000 |                    72,000,000 |             2,400,000 |                    72GB |                    33.6GB |                      864GB |

**Local only:** 1KB × 24 × 30 ≈ **0.72MB/user-month**; ~8.76MB/user-year, before rotation/metadata. At 5KB/payload, ~3.6MB/month. The Mac's per-hour short-lived Node/Bun process memory is not persistent; the provider CLIs and their transport startup dominate elapsed seconds and upstream rate-limit exposure. One hour may be **too sparse for 5-hour rolling windows**; sample adaptively while active and respect cooldown.

## 4. Cloud cost scenarios (illustrative, excluding engineering/support)

### Low-cost architecture: one D1 batch row per user/device/hour

Persist one `snapshot_batch` JSON record indexed by `user_id+observed_at`, not one row for every provider/window. One range query for a user retrieves ~336 records for 14 days, enough for browser filtering/forecast. Maintain separate compact `last_state` and `daily_aggregate` tables. Normalize inside TypeScript at read time; this intentionally trades a small local JSON parse for fewer D1 writes and smaller database size. This does **not** mean the public API lacks typed provider/window fields.

**D1 steady state:** each snapshot added then eventually removed after archival. In a mature 14d hot rolling system, ~N inserts/month and ~N deletes/month; with one indexed column set, approximate billable writes are **2–4× N**, depending on index maintenance and actual measured statement metrics. Verify with `meta.rows_written`, don't assume one insert equals one billable row. Hot SQLite physical capacity use **1–2KB per snapshot** illustrative range (JSON + row + index); 10k users ~3.36–6.72GB before page fragmentation. A single D1 remains below its 10GB limit in that example, but could exceed at a larger payload, added devices or multiple indexed window rows.

|   Users | Worker requests/mo | D1 steady write units/mo (2–4× snapshot events) |     D1 hot physical size proxy | R2 archive PUT/mo if one/user/day | Cloudflare marginal expectation                                                                                                                                                 |
| ------: | -----------------: | ----------------------------------------------: | -----------------------------: | --------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     100 |                72k |                                      0.14–0.29M |                        34–67MB |                                3k | May fit **free**; ~$0 incremental on paid shared account                                                                                                                        |
|   1,000 |              0.72M |                                        1.4–2.9M |                    0.34–0.67GB |                               30k | D1 Free per-db 500MB can fail; paid shared account roughly $0 incremental                                                                                                       |
|  10,000 |               7.2M |                                      14.4–28.8M |                    3.36–6.72GB |                              300k | Within paid Workers+50M D1-write included quotas; storage over 5GB potentially **~$0–$1.3/mo**, plus small CPU/read/other uses; paid base **$5/mo** if account not already paid |
| 100,000 |                72M |                                        144–288M | 33.6–67.2GB, **must shard D1** |                                3M | Incremental Workers requests ~$18.60; D1 writes ~$94–$238; D1 hot storage ~$21–$47; R2 PUT ~$9; plus CPU, reads, ops: **roughly $150–$350+/month** on the base scenario         |

**Critical caveats:** These are **engineering estimates**, not official quotes; no 100k-user guarantee. At 100k users a single D1 DB cannot hold the hot history (10GB max) and a single serialized writer is a throughput risk; shard by stable user partition or redesign hot storage. At 10k users, randomized client schedules yield an average 2.78 writes/s, but synchronized hourly startup can burst; add 0–180s jitter and backpressure. Extra indexes, 4–8 windows as separate DB rows, 2+ devices/user, missing auth retries, dashboards, backups, WAF and raw logs can multiply cost. Cost include **Cloudflare's existing global account quota usage**, not hypothetical isolated full included quotas.

For a simple CPU illustration at 100k users with an average 2 CPU-ms per upload: 72M × 2ms =144M CPU-ms; beyond 30M included => **~$2.28/mo**. Complex serialization, cryptography and additional scheduled jobs can cost more. Billing request/CPU inclusive numbers must be measured in production.

### R2 strategy: daily archives, not hourly small objects

At 10k users, **one R2 PUT per user per hour** =7.2M Class A/month, about `(7.2-1.0) × $4.50 ≈ $27.90/mo` ignoring sharing. **One per user per day** =300k PUT/month, within 1M free; fewer tiny objects and better compression. 100k users ×30 daily PUT=3M/month → approx $9 above included. R2 Standard storage for a 10k user-year at 1KB hourly raw is 86.4GB; if gzip/Parquet reduces it to 30–60%, ~26–52GB, above 10GB free only ~$0.24–$0.63 per month at the end of year. (No guarantee of compression; object list and billing round-up remain.)

**Tiny Parquet is not automatically better.** A 24-row/user/day file has metadata + compression overhead; a `jsonl.gz` per user/day is simple, cheap, deletable and readable with streaming JS. For global sanitized analytics, merge per-day/per-provider opt-in records into multi-MB Parquet partition files and use DuckDB batch SQL. Keep private archives per user so deletion/exports don't require rewriting giant shared objects.

### Avoid these expensive patterns

1. Cloud hourly poll of vendor APIs on behalf of every user: requires moving credentials and vendor API access, wrong security boundary. Collect locally.
2. One Worker request per provider/window/metric: amplifies requests, concurrency, indexing and quota; batch per device interval.
3. One R2 object per individual measurement: excess tiny PUTs and costly list management.
4. One D1 database per subscriber: operational complexity and per-database caps; no proven value for this small fixed-shape telemetry. Start sharded by cohort only when limits demand.
5. Dedicated ClickHouse/BigQuery/OLAP cluster before product market fit: additional idle/admin cost; daily small batch and indexed D1 suffice.
6. Fetch full raw years for every dashboard load: serve daily aggregates and on-demand raw range only.

## 5. R2 + D1 lifecycle verification checklist

| Step | Action                                                               | Loss-prevention condition                                                          |
| ---- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1    | Select closed daily D1 range with high-water event ID                | Deterministic `(user,date,range)` manifest; late arrivals redirected or reconciled |
| 2    | Upload immutable gzip JSONL to R2 with unique part key               | No concurrent overwrites, checksum and row count recorded                          |
| 3    | Read back/checksum, register `archive_manifest.state=verified` in D1 | Existence alone insufficient; verify bytes/row count/schema                        |
| 4    | Grace period + idempotent D1 chunk delete                            | Delete only rows covered by verified manifest; limit batch and retry               |
| 5    | Audit retrieval/restore and orphan scans                             | Test random user historical download and rehydration; alert gaps                   |
| 6    | Apply user delete/retention                                          | Propagate to D1, R2 private archives, derived research pool policy                 |

At least one disaster-recovery test must simulate crash between steps 2 and 4 and prove no lost rows. Consider legal/requested deletion of research aggregates and public statistics separately. R2 lifecycle rules can enforce age expiration but are not a substitute for archival checkpoint correctness. [Official lifecycle docs](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).

## 6. Browser Parquet / OLAP alternatives

| Choice              | Benefit                                         | Drawback                                                         | Kuota recommendation                                       |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| JSONL locally       | Append, inspect, export, easy migration         | Need range scans/rotation; no index                              | **MVP local store**                                        |
| SQLite locally      | Fast ranges/index, transaction/dedupe, portable | Extra platform adapter/binding                                   | Add if JSONL complexity grows; isolated `packages/history` |
| D1 hot 14d          | Serverless query/auth, no always-on DB          | 10GB per-db cap, row writes/index costs, serial writes per DB    | **Yes**, one combined batch row, shard later               |
| R2 `jsonl.gz` cold  | Cheap bytes, delete/export per user             | Object immutable, whole-file fetch per day                       | **Yes**, archive daily after verification                  |
| R2 Parquet research | Efficient column scan + compression             | Small-file penalty, partition/compaction, JS decoding complexity | **Yes later** for opt-in pool, 1–100MB partitions          |
| DuckDB ephemeral    | SQL over Parquet/R2, no permanent server        | Need scheduled job host/containers and S3 credentials            | **Yes later**, daily/weekly batch                          |
| Always-on OLAP      | High-dimensional interactive analytic workloads | Idle billing/ops/data migration                                  | **No** initially                                           |

Browser Parquet **is possible**: [hyparquet](https://github.com/hyparam/hyparquet) is a JS browser parser; [DuckDB-Wasm](https://duckdb.org/docs/stable/clients/wasm/overview) runs in a browser; [DuckDB Parquet](https://duckdb.org/docs/data/parquet) and [R2 via S3-compatible DuckDB](https://www.duckdb.org/docs/current/guides/network_cloud_storage/s3_import) provide server/batch options. Consider CSP/CORS/range requests/large Wasm cost; for Kuota charts, return precomputed JSON series and optionally let the user download raw Parquet.

## 7. Forecast research: avoid false precision

- **Ideal progress marker** needs fixed window start/end and one valid `used%`. It is mathematical time fraction, not future-use prediction. For a "remaining bar", reverse orientation to `idealRemainingPct`.
- **ETA** needs multiple comparable observations. With 55% consumed at 3.5/7 days, even-pace remaining marker 50%; linear projection = exhausted near 6.36th day, ~15h early. An intense 1h first sample does **not** warrant a precise exhaustion timestamp: mark `low confidence`.
- **Rolling limits** can refill before a nominal reset; percent decline is not necessarily data error or a full cycle reset. No fixed depletion forecast without provider-specific model.
- **Effective tokens/limit** `Δtokens/(ΔusedPct/100)` can be biased by model mix, discounts, caching, changing policies, stale data and mismatched counters; label experimental and never claim true provider cap. Detect vendor policy shift only through opt-in comparable cohorts and proper sample sizes.
- **Free local usage** is not proof of personal identity anonymity. Provider + plan + exact timestamps + token time series and project metadata can serve as quasi-identifiers. NIST warns about de-identification and re-identification risk: [NIST IR 8053](https://csrc.nist.gov/Pubs/ir/8053/Final), [NIST SP 800-188](https://csrc.nist.gov/pubs/sp/800/188/final).

## 8. Daily aggregate design and privacy

Cloud community row example (no user/project ID): `{provider, planBucket, windowKind, UTC_day, cohortCount, optInUsers, sampleCoverage, p25DailyUsedPercent, medianDailyUsedPercent, p75DailyUsedPercent, modelMixBucket, quality, methodologyVersion}`. Apply minimum cohort **30** (recommend 50) and suppress rare cross-filter combinations. Round/bucket exact token counts and time, use stable cohort min sizes, discourage differencing attacks between overlapping filters. No open API with per-user raw research events.

For the first thousands of users, aggregate in a scheduled Cloudflare Worker with bounded D1 indexed scans and write finalized daily aggregates to D1. When cohorts outgrow this or need robust models, export sanitized opt-in partitions to R2 and run **ephemeral DuckDB** from a job/CI/container under budget, commit final metrics back to D1. Do not depend on HK's personal Mac mini being always online for production retention. Avoid querying all private per-user files to create an ostensibly anonymous research pool.

Cloudflare Analytics Engine is an alternative for _sampled aggregate telemetry_, not exact user history: [pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/). Cloudflare Queues can be added for burst buffering, but its operation model can add costs and operational objects; [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/). Neither is needed in the MVP.

## 9. Business packaging as a Kunkun feature

Suggested tier split **subject to product validation**:

- **Free, anonymous account not required:** local reads, ideal pace, local history, basic forecasts, CLI/JSON, UniView TUI, 30d local retention; no forced telemetry upload.
- **Optional data contribution:** participation in the community research pool earns comparative charts, labeled opt-in; not a prerequisite to use free local core.
- **Kunkun Cloud bundle / Pro:** private cross-device sync, long history, scheduled notifications, authenticated API/MCP, project breakdown/automation and extra storage. Prefer bundled pricing in Kunkun over selling a separate $1–3 monthly subscription prematurely.
- **Teams later:** aggregated per-workspace reporting with proper admin and user consent; enterprise data residency, BYOS, organization SSO only after proven demand.

**Cost is not a strong reason to lock privacy behind payment.** In a low-volume beta, provider adapter maintenance, support, auth and trust are likely costlier than R2 storage. For launch: collect operational anonymous service metrics separately from opt-in usage research and publish a transparent data-sharing FAQ.

## 10. Complexity and rollout recommendation

| Phase | Feature                                                    | Rough AI-assisted engineering range (not elapsed guarantee) | Main unknown                                      |
| ----- | ---------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| A     | White pace tick + typed pure function + CLI forecast field | 0.5–1.5d                                                    | Correct fixed/rolling semantics                   |
| B     | Local scheduler, JSONL history, ranged query, TUI trend    | 2–5d                                                        | Account identity, OS sleep, safe append           |
| C     | Robust forecast, confidence, plots/alerts, backtests       | 2–5d                                                        | Provider cadence and model calibration            |
| D     | Kunkun host bridge + React shadcn dashboard                | 3–7d                                                        | Actual plugin SDK/permissions verified            |
| E     | Authenticated cloud sync + D1 hot / R2 archive             | 4–10d                                                       | Consent, idempotency, safe archive recovery       |
| F     | Public research cohorts + token cap inference + API        | 1–3wk                                                       | Reidentification defense and statistical validity |

These overlap and depend on existing `refresh-service` plan; do not sum durations as a hard schedule. Compared with Xross kernel/P2P work, core math/storage are simpler; compared with CRUD, provider incompatibility, privacy and data provenance add real engineering complexity. **Build A+B before committing to E+F.**

## 11. Additional official references and verification notes

- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) (last updated 2026-04-21 in documentation), [limits](https://developers.cloudflare.com/d1/platform/limits/), [performance & FAQ](https://developers.cloudflare.com/d1/reference/faq/).
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) (retrieved November 2026), [Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) (updated Oct 2026), [consistency](https://developers.cloudflare.com/r2/reference/consistency/), [lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).
- [DuckDB Parquet pushdown](https://duckdb.org/docs/data/parquet), [R2/S3 read](https://www.duckdb.org/docs/current/guides/network_cloud_storage/s3_import), [hyparquet pure JS](https://github.com/hyparam/hyparquet).
- [NIST SP 800-188 privacy risk](https://csrc.nist.gov/pubs/sp/800/188/final).
- Quota reader baseline source, test results and caveats: `docs/implementation-status-2026-11-05.md`, `docs/research/2026-11-06-kuota-provider-research.md`.

**Recommended decision:** implement local history and pace now; schedule private cloud as a separate milestone; do research pooling only after opt-in policy and provider-specific statistical backtesting. This document supports a project review; **not permission to deploy paid infrastructure**.
