---
title: "Loading an earthquake feed without counting a quake twice"
summary: "How I pull the USGS earthquake feed into tested tables, why I keep every revision of every event, and what the first production runs showed."
project: lagom
track: etl
order: 1
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0003", "0023", "0026"]
---

An earthquake record isn't final when it's published. The USGS keeps revising magnitude, location and status for days. A pipeline that copies the feed once and forgets it gets those numbers wrong, and a pipeline that runs twice must not count the same quake twice. This was the first pipeline of Lagom, my open-source data platform for one small machine, to run end to end, and it had to get both right.

[Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L41-L49) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L139-L152)

## What I built

The source is the USGS earthquake web service: GeoJSON over HTTP, with no key and no login.

[Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L3-L11)

![Flowchart: the USGS web service feeds dlt, which writes bronze Parquet files to R2 and records them in a Postgres catalog; dbt then builds silver and gold from them. A Dagster schedule starts both steps every 30 minutes.](/diagrams/etl-usgs-pipeline.svg)

**dlt** does the fetching. It's a Python library, not a server: it runs inside the job and exits, so nothing stays in memory between runs. The whole source (URL, paginator, cursor, key, column types) is declared in a YAML file, and the Python holds no URL, window or threshold.

[Source: the ingestion decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0003-ingestion-split-dlt-benthos.md#L60-L63) · [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L16-L22)

The **cursor**, the bookmark that says "I have read up to here", is each event's `updated` time. dlt saves it in its pipeline state and writes that state to the destination too. A run starts with no disk, so it restores the bookmark from the lake.

[Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L33-L39)

The load is a **merge on `(id, properties__updated)`**. Bronze, the raw layer, keeps every revision: a revised event is a new row, and a later layer decides which revision is current. Because the revision time is part of the key, loading the same revision twice replaces its own row. Re-running a window inserts nothing new.

[Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L41-L49)

The destination is **DuckLake**: Parquet files plus a catalog that records which files form which table at which snapshot. Think of the files as books on shelves and the catalog as the card index. The catalog sits in Postgres, one database per environment, and the files sit in that environment's R2 bucket (Cloudflare's object storage). An environment here is staging, my rehearsal copy, or production.

[Source: the storage decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L41-L47) · [Source: the Dagster decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L61-L66)

**dbt**, which turns SQL files into tables and tests them, then builds silver and gold. Silver keeps one row per event, its latest revision, typed, with times in UTC. Gold holds the earthquakes only, with magnitude and depth classes, plus daily counts per region. Both gold models have an enforced contract, and `dbt build` runs the tests in dependency order. They include reconciliations: silver rows must equal the distinct ids in bronze, and the daily counts must add up to gold.

[Source: warehouse README, layers](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L7-L11) · [Source: warehouse README, tests](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L35-L47)

**Dagster**, the scheduler, starts both steps every 30 minutes. Its run queue allows one run of the pipeline at a time, because two runs would both read dlt's cursor and write it back.

[Source: the Dagster decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L47-L69) · [Source: definitions.py](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/orchestration/lagom_orchestration/definitions.py#L47-L50)

## Why this way

The whole point of Lagom is to show that open-source tools on one small machine can do this job, so every choice here had a memory price tag. My first design used Redpanda Connect for everything. It's good at message pipelines but weak at batch APIs in five ways: pagination, cursor state across runs, schema inference, flattening nested JSON, and backfills. Each would have become a hand-built workaround. Airbyte solves extraction but needs Temporal, a worker and its own database, so I excluded it on memory.

[Source: the ingestion decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0003-ingestion-split-dlt-benthos.md#L26-L37)

The merge key is a trade-off too. `append` would duplicate rows on every re-run, and a key on `id` alone would overwrite history. Keeping every revision costs some rows. Counting a quake twice, or losing its history, costs more.

[Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L41-L49)

One thing is still open. USGS runs on DuckLake today, but my proposal to use DuckLake for the whole warehouse is still marked Proposed, and the roadmap item for the trial that would settle it is unchecked.

[Source: the storage decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L3-L4) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L238-L242)

## How it's going

The first real load, into the development database on Postgres on 2026-10-17, brought 10,168 events (30 days) in 15 s.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L157-L158)

After the move to DuckLake, staging's Dagster succeeded on 372 of 373 runs in its first week. The first production run, on 2026-11-05 at 12:00 UTC, loaded 30 days: 10,042 events, with dbt reporting PASS=33.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L263-L265)

In that first week the median run took 43 s and the longest 136 s. In the run of 2026-10-28 at 21:30, the load took 7 s and dbt 23 s; the rest was Dagster's own start-up and per-step overhead. Production's first run peaked at 550 MiB against a request of 768 MiB, but the samples were 2 to 15 s apart, so a short peak may be missed. These are results of those runs, not a promise about future volume.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1748-L1754) · [Source: resource budget](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L605)

## Gotchas

- **Only the last 30 days.** The query sends no start time, and the API then returns only events whose origin is in the last 30 days, whatever the cursor says. Checked with the count endpoint on 2026-10-28: 9,474 events updated since 2026-10-01 without a start time, 12,318 with one. I accepted two consequences: a revision published after an event is 30 days old is never loaded, and a re-load brings back 30 days at most. [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L51-L60)
- **The same field is `4` or `4.1`.** dlt types a column from the first value it sees, so the fractional fields are declared `double` in the YAML. A field whose type changes then fails the run instead of adding a second column. [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L62-L71)
- **One list became three rows.** `geometry.coordinates` is `[longitude, latitude, depth]`. dlt turns a list into a child table, which would make one event three meaningless rows, so a column hint keeps it as one JSON value. [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L73-L81)
- **Big responses arrive cut.** The API allows 20,000 events per page but returned truncated JSON for a few thousand, so the page size is 1,000, about 9 pages for a 30-day backfill. A truncated response fails the run, and re-running is safe. [Source: source.yaml](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/ingestion/source.yaml#L44-L48) · [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L222-L223)
- **Silence is a failure.** The feed averages about 9 events an hour, so six hours with no new events raise an error naming the window. [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L89-L94)
- **DuckDB is pinned to 1.5.x.** Version 2.0 breaks dlt 1.31. [Source: the Dagster decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L19-L22)
- **Not yet covered.** Offset paging is not a snapshot: an event revised mid-run can shift the pages, and nothing detects a skipped one yet. A freshness check on bronze exists (warn after 2 hours, error after 6), but `dbt build` does not run it, and the roadmap item "freshness threshold declared and asserted" is still open. [Source: USGS service README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/services/usgs/README.md#L217-L221) · [Source: warehouse README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L47) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L285)
