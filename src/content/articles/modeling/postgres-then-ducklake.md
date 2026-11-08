---
title: "Postgres first, then DuckLake: a storage decision still open"
summary: "Why every warehouse layer started in Postgres, how a measured trigger kept the lakehouse out, and what is proposed, decided and still unmeasured about DuckDB on DuckLake."
project: lagom
track: modeling
order: 1
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0004", "0005", "0008", "0023", "0026", "0033"]
---

Where should a small data platform keep its tables, and what should do the sums? Lagom answered one way on its first day and is testing a different answer now. The honest account has three parts: what was decided, what is only proposed, and what is already running in production anyway.

[Source: roadmap, trigger table](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L27-L28)

## What we built: two storage designs

A warehouse here has three layers. **Bronze** is the raw data, typed. **Silver** is cleaned and conformed. **Gold** is modelled for the people who read it.

The first design, decided on 2026-10-12, kept all three as schemas in each environment's Postgres. dlt loads bronze, dbt builds silver and gold with its SQL running inside Postgres, and consumers read gold. Bronze is append-only and kept, so replaying a transformation means re-running dbt, not re-reading the source. One backup captures every layer.

[Source: ADR-0008](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L64-L69) · [Source: ADR-0008, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L102-L115) · [Source: architecture, dbt](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L201-L203)

The proposal, written on 2026-10-28, is a different split of work. **DuckDB**, an engine that spills to disk instead of failing when memory runs out, does the computing, including dbt's transformations. **DuckLake** is the table format: Parquet files plus a catalog that records which files form which table at which snapshot. The catalog stays in Postgres. The files rest on Cloudflare R2.

[Source: ADR-0023](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L28-L31) · [Source: ADR-0023, the stack](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L41-L47)

![Flowchart: dlt writes Parquet files to R2, DuckDB and dbt build silver and gold from them as more Parquet files on R2, and both steps record the files in a Postgres catalog.](/diagrams/modeling-postgres-then-ducklake-2.svg)

The reason for R2 is that the data outlives the node. Compute becomes stateless, the only state to protect is the catalog (a few megabytes), and recovery means rebuilding the node and restoring the catalog, with no re-load from the source.

[Source: ADR-0023](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L49-L56)

## Why this choice: waiting, then proposing

**Why Postgres first.** ADR-0008 asked what the lake would do now, and the answer was: nothing Postgres cannot. There was one source, with a volume measured in megabytes. An earlier ADR had rejected "Postgres alone" because a row store suffers on heavy aggregation, but ADR-0008 observed that this is true at volume and there was no volume. The rejected alternatives were a lakehouse on R2 now (a vendor, a payment method, a credential per environment, uncapped operation billing) and one on the node's own disk. The operator did want a lakehouse, and chose to wait for a real reason.

[Source: ADR-0008](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L19-L29) · [Source: ADR-0008, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L48-L62)

The lakehouse was to enter on an **observed** trigger, not an anticipated one: a dbt model Postgres handles badly within its memory budget, Postgres data above 10 GB of the 40 GB disk, a source whose payload is files, or a consumer that needs files. The table format (ADR-0004, Iceberg preferred and Delta as fallback, to be chosen by a test) was deferred with it.

[Source: ADR-0008, triggers](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L86-L100) · [Source: ADR-0004](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0004-table-format.md#L45-L53)

![Timeline of the storage decision: on 2026-10-12 ADR-0004, ADR-0005 and ADR-0008; on 2026-10-28 ADR-0023 and a local run; on 2026-11-05 the first production run on DuckLake; on 2026-11-07 the Postgres CronJobs retired.](/diagrams/modeling-postgres-then-ducklake.svg)

**Why it moved.** ADR-0023 gives a purpose, not a measurement. The platform should show that small and medium enterprises get results fast on simple, solid infrastructure. Postgres is a row store that slows on scans of large tables; DuckDB is columnar. The ADR calls both points mainstream, but says the figures vendors publish are not independent, so a spike measures them here. ADR-0008's own note from the same day records that R2 would enter before any measured limit of Postgres, as a bridge for Parquet exports to the site rather than a warehouse layer, with the lakehouse itself coming later as a showcase.

[Source: ADR-0023](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L23-L33) · [Source: ADR-0008, note](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L143-L148)

The trade-offs it accepts are written down: DuckLake is young (six months since 1.0 when written), DuckDB serves one process so there is no server for many interactive readers, per-table grants exist in Postgres but not in DuckLake, and R2 is one more dependency with two new secrets.

[Source: ADR-0023, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L100-L112)

## How it has worked: the spike is still open

At the pinned commit ADR-0023 is still Proposed, to be accepted or revised with the numbers of the spike. The spike must show four things: the USGS pipeline passing on DuckLake, Evidence reading it, small files handled with R2 operations inside the free tier, and peak memory and `dbt build` time compared with Postgres. In the roadmap its item is unchecked. If any check fails, the ADR is revised, not accepted.

[Source: ADR-0023, status](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L3-L4) · [Source: ADR-0023, the spike](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L76-L92) · [Source: roadmap, M3](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L238-L242)

What did happen is operational. A local run on 2026-10-28 built the models with dbt PASS=33. Dagster has run USGS on DuckLake in staging since 2026-10-28 and in prod since 2026-11-05, and staging's first week was 372 of 373 runs succeeding.

[Source: ADR-0026](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L19-L22) · [Source: roadmap, M3](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L252-L256) · [Source: roadmap, M3](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L263-L265)

## Gotchas: the warehouse moved first

- **The warehouse moved before the decision.** On 2026-11-07 the Postgres CronJobs were retired in the change that turned Dagster's alarm on, without waiting for the spike. From then gold lives in DuckLake while ADR-0023 is still Proposed, and the Postgres warehouse stopped updating. The reversal is written: re-target the dbt models to Postgres and load the data back from the Parquet files or from USGS. The Postgres Clusters stay, because they hold Dagster's metastore and DuckLake's catalog. [Source: ADR-0033](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L106-L111) · [Source: ADR-0033, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L121-L130)
- **The Postgres comparison is still owed.** With the CronJobs gone, the Postgres side of the memory and time comparison is to be measured once, by hand, from a re-load, if ADR-0023 still asks for it. [Source: ADR-0033](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L22-L29)
- **A role came back.** ADR-0005 had considered Postgres as a table-format catalog and rejected it as over-engineering, since dlt wrote files and DuckDB read by path. ADR-0023 gives Postgres exactly that role, because DuckLake needs a catalog and dlt's documentation names Postgres as the only production-grade one with full parallelism. [Source: ADR-0005](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0005-duckdb-and-postgres-roles.md#L63-L66) · [Source: ADR-0023](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L47)
- **Portable SQL paid off, within limits.** The same dbt models build on both targets, using `trim` rather than Postgres's `btrim`. The `gold_reader` grants and their test run on Postgres only, since DuckLake has no per-table grants. dbt's partial parsing can carry one target's result into the other, so switching targets in a checkout needs `--no-partial-parse`. [Source: warehouse README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L114-L127)
- **The catalog URI can leak a password.** When attaching the lake fails, DuckDB repeats the catalog URI, password included (checked on duckdb 1.5.6), so the alarm strips such text before it is sent. [Source: ADR-0033](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L146-L150)
- **A claim that stayed unverified.** ADR-0004 recorded that Iceberg is understood to store absolute file paths, which would make moving a table a metadata rewrite, and said both formats' behaviour was unverified. ADR-0004 is still Proposed, with no test result recorded in it, while ADR-0023 would put DuckLake in Iceberg's place for this stack if it is accepted. [Source: ADR-0004](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0004-table-format.md#L3-L4) · [Source: ADR-0004, notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0004-table-format.md#L85-L89) · [Source: ADR-0023](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L7-L10)

## What comes next: the spike decides

The spike's four checks decide whether ADR-0023 is accepted or revised. If it is revised, its reversal applies and the warehouse returns to Postgres.

[Source: ADR-0023, reversal](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L114-L120)
