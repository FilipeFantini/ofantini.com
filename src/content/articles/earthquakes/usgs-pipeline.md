---
title: "Incremental loading of the USGS earthquake feed"
summary: "How the USGS earthquake feed is pulled into tested tables, why every revision of every event is kept, and what the first production runs showed."
project: lagom
subproject: earthquakes
kind: pipeline
order: 1
published: 2026-11-09
updated: 2026-11-21
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0003", "0023", "0026"]
---

An earthquake record is not final when published: the USGS revises magnitude, location and status for days. A pipeline that copies the feed once gets those numbers wrong, and one that runs twice must not count a quake twice. This was the first pipeline of Lagom, an open-source data platform for one small machine, to run end to end.

[Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L41-L49) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L139-L152)

## What was built

The source is the USGS earthquake web service: GeoJSON over HTTP, with no key and no login.

[Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L3-L11)

![Flowchart: the USGS web service feeds dlt, which writes bronze Parquet files to R2 and records them in a Postgres catalog; dbt then builds silver and gold from them. A Dagster schedule starts both steps every 30 minutes.](/diagrams/etl-usgs-pipeline.svg)

**dlt** does the fetching: a Python library that runs inside the job and exits, so nothing stays in memory between runs. The whole source (URL, paginator, cursor, key, column types) is declared in YAML, not in Python.

[Source: the ingestion decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0003-ingestion-split-dlt-benthos.md#L60-L63) · [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L16-L22)

The **cursor**, the bookmark of how far the feed has been read, is each event's `updated` time. dlt stores it in the destination with its pipeline state, so each run, which starts with no disk, restores it from the lake.

[Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L33-L39)

The load is a **merge on `(id, properties__updated)`**. Bronze, the raw layer, keeps every revision as its own row, and a later layer picks the current one. Because the revision time is in the key, reloading a revision replaces its own row, so re-running a window inserts nothing.

[Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L41-L49)

The destination is **DuckLake**: Parquet files in R2, Cloudflare's object storage, plus a catalog in Postgres that records which files form which table at which snapshot, one of each per environment (staging or production).

[Source: the storage decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L41-L47) · [Source: the Dagster decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L61-L66)

**dbt** then builds silver and gold from SQL files and tests them. Silver keeps the latest revision of each event, typed, in UTC. Gold holds the earthquakes only, with magnitude and depth classes, plus daily counts per region, under enforced contracts. The tests include reconciliations: silver rows must equal the distinct ids in bronze, and the daily counts must add up to gold.

[Source: warehouse README, layers](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L7-L11) · [Source: warehouse README, tests](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L35-L47)

**Dagster**, the scheduler, starts both steps every 30 minutes, one run at a time, because two runs would both read dlt's cursor and write it back.

[Source: the Dagster decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L47-L69) · [Source: definitions.py](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/orchestration/lagom_orchestration/definitions.py#L47-L50)

## Why this way

Lagom sets out to show that open-source tools on one small machine can do this job, so every choice had a memory price. Redpanda Connect, the first design, is good at message pipelines but weak at batch APIs: pagination, cursor state across runs, schema inference, nested JSON and backfills would each have needed a workaround. Airbyte solves extraction but needs Temporal, a worker and its own database, so it was excluded on memory.

[Source: the ingestion decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0003-ingestion-split-dlt-benthos.md#L26-L37)

The merge key is a trade-off too: `append` would duplicate rows on every re-run, and a key on `id` alone would overwrite history. Keeping every revision costs some rows; counting a quake twice, or losing its history, costs more.

[Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L41-L49)

Still open: USGS runs on DuckLake today, but the proposal to move the whole warehouse to DuckLake is still Proposed, pending a trial that the roadmap lists as open.

[Source: the storage decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L3-L4) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L238-L242)

## Results so far

The first real load, into the development database on Postgres on 2026-10-17, brought 10,168 events (30 days) in 15 s.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L157-L158)

After the move to DuckLake, staging's Dagster succeeded on 372 of 373 runs in its first week. The first production run, on 2026-11-05 at 12:00 UTC, loaded 30 days: 10,042 events, with dbt reporting PASS=33.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L263-L265)

In that week the median run took 43 s and the longest 136 s. In one run, on 2026-10-28 at 21:30, the load took 7 s and dbt 23 s; the rest was Dagster's start-up and per-step overhead. Production's first run peaked at 550 MiB against a request of 768 MiB, sampled every 2 to 15 s, so a short peak may be missed.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1748-L1754) · [Source: resource budget](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L605)

## Pitfalls

- **Only the last 30 days.** Without a start time, the API returns only events whose origin is in the last 30 days, whatever the cursor says: on 2026-10-28 the count endpoint gave 9,474 events updated since 2026-10-01 without one, 12,318 with one. So a revision published after an event is 30 days old is never loaded, and a re-load brings back 30 days at most; both are accepted. [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L51-L60)
- **The same field is `4` or `4.1`.** dlt types a column from its first value, so fractional fields are declared `double`, and a type change fails the run instead of adding a second column. [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L62-L71)
- **One list became three rows.** dlt turns a list into a child table, which would split `geometry.coordinates` (`[longitude, latitude, depth]`) into three meaningless rows, so a column hint keeps it as one JSON value. [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L73-L81)
- **Big responses arrive cut.** The API allows 20,000 events per page but truncated JSON at a few thousand, so pages hold 1,000, about 9 for a 30-day backfill. A truncated response fails the run, and re-running is safe. [Source: source.yaml](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/ingestion/source.yaml#L44-L48) · [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L222-L223)
- **Silence is a failure.** The feed averages about 9 events an hour, so six hours with no new events raise an error naming the window. [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L89-L94)
- **DuckDB is pinned to 1.5.x.** Version 2.0 breaks dlt 1.31. [Source: the Dagster decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L19-L22)
- **Not yet covered.** Offset paging is not a snapshot: an event revised mid-run can shift the pages, and a skipped one goes undetected. A freshness check on bronze exists (warn after 2 hours, error after 6), but `dbt build` does not run it, and the roadmap item for it is still open. [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L217-L221) · [Source: warehouse README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L47) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L285)
