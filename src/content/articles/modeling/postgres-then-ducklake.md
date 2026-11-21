---
title: "Warehouse storage: Postgres first, DuckLake on trial"
summary: "Why every layer of the warehouse started in Postgres, how a measured trigger kept the lakehouse out, and what is decided, proposed and still unmeasured about DuckDB on DuckLake."
project: lagom
group: modeling
order: 1
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0004", "0005", "0008", "0023", "0026", "0033"]
---

Where should a small data platform keep its tables, and what should compute them? One answer was chosen on the first day of Lagom; a different one is on trial. This account separates what was decided, what is only proposed, and what already runs in production.

[Source: roadmap, trigger table](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L27-L28)

## How it works

A warehouse here has three layers. **Bronze** is the raw data, typed. **Silver** is cleaned and conformed. **Gold** is modelled for the people who read it.

The first design, decided on 2026-10-12, kept all three as schemas in each environment's Postgres: dlt loads bronze, dbt builds silver and gold inside Postgres, and one backup covers every layer.

[Source: the Postgres decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L64-L69) · [Source: the Postgres decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L102-L115)

The proposal, written on 2026-10-28, splits the work. **DuckDB**, an engine that spills to disk instead of failing when memory runs out, does the computing, dbt's transformations included. **DuckLake** is the table format: Parquet files plus a catalog of which files form which table at which snapshot. The catalog stays in Postgres and the files go to Cloudflare R2, object storage, so the data outlives the node and only the catalog needs protecting.

[Source: the DuckLake proposal](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L28-L31) · [Source: the DuckLake proposal, the stack](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L41-L47) · [Source: the DuckLake proposal](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L49-L56)

![Flowchart: dlt writes Parquet files to R2, DuckDB and dbt build silver and gold from them as more Parquet files on R2, and both steps record the files in a Postgres catalog.](/diagrams/modeling-postgres-then-ducklake-2.svg)

## The trade-off

Postgres came first because there was one source, measured in megabytes, and a lake would have added nothing. The lakehouse was to enter on an observed trigger, not an anticipated one.

[Source: the Postgres decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L19-L29) · [Source: the Postgres decision, triggers](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L86-L100)

The DuckLake proposal rests on a purpose, not a measurement: to show that small and medium enterprises get results fast on simple, solid infrastructure, with DuckDB columnar where Postgres stores rows. It accepts that DuckLake is young, DuckDB serves one process, per-table grants exist in Postgres but not in DuckLake, and R2 adds a dependency and two secrets.

[Source: the DuckLake proposal](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L23-L33) · [Source: the DuckLake proposal, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L100-L112)

The proposal is still Proposed, pending a trial with four checks. Yet Dagster has run the earthquake pipeline on DuckLake in staging since 2026-10-28 and in prod since 2026-11-05, and the Postgres scheduled jobs were retired on 2026-11-07, so gold lives in DuckLake while the decision is open. The reversal is written: re-target the dbt models to Postgres and load the data back.

[Source: the DuckLake proposal, the trial](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L76-L92) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L238-L242) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L252-L256) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L263-L265) · [Source: the alerts decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L106-L111) · [Source: the alerts decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L121-L130)

## Details

Alternatives, the table format left open, when R2 would enter, portable SQL, a leaking catalog URI and the comparison still owed:

[Source: the Postgres decision, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L48-L62) · [Source: the table-format decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0004-table-format.md#L45-L53) · [Source: the Postgres decision, note](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0008-postgres-for-all-layers.md#L143-L148) · [Source: the roles decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0005-duckdb-and-postgres-roles.md#L63-L66) · [Source: warehouse README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L114-L127) · [Source: the alerts decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L146-L150) · [Source: the alerts decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L22-L29)
