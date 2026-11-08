---
title: "Running dbt in CI, on twelve made-up rows"
summary: "How every pull request now builds and tests the warehouse models on a fixture DuckLake, why the first version was red on purpose, and what it still cannot see."
project: lagom
track: modeling
order: 2
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0018"]
---

A change to a data model can be valid SQL and still give wrong numbers. For a while Lagom's checks on a pull request could tell that the models parsed, but not that they produced the right tables. We wanted that proof to come before the merge, without credentials, without real data and without a database server.

[Source: ci.yml, before](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L160-L167)

## What we built

One job in the CI workflow, called `warehouse`, runs on GitHub's machines, so it costs the node nothing. It lints the SQL and parses the dbt project. A later step runs the real thing: `dbt build` on the `lake` target, the target Dagster runs in staging and prod, over a small hand-made bronze table.

[Source: ci.yml](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L1-L2) · [Source: ci.yml](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L149-L195)

![Flowchart: a pull request starts the CI job, which lints and parses, loads 12 hand-made bronze rows into a temporary DuckLake on the runner's disk, runs dbt build on the lake target with models, contracts, unit tests, data tests and reconciliations, and ends in a green or red check.](/diagrams/modeling-dbt-in-ci.svg)

A script loads the fixture, a SQL file of 12 rows, into a DuckLake whose catalog and Parquet files sit in a temporary directory on the runner. Nothing reaches R2 or Postgres, and the R2 variables the profile requires are placeholders. The build then runs the models, the contracts (column names and types checked before a table is written), the unit tests, the data tests and the reconciliations between layers. It uses the same dbt and DuckDB versions as the production image, because dbt-duckdb is locked in the orchestration project and CI runs from that same environment.

[Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L52-L63) · [Source: warehouse README, contracts](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L42) · [Source: ci.yml](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L175-L200)

The 12 rows are chosen so that each rule is reached: two revisions of one event, every magnitude and depth class, a quarry blast that belongs in silver but not gold, a status in capitals, a place with no comma, and an event after midnight UTC that makes a second day in the daily aggregate.

[Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L60-L63) · [Source: fixture](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/ci/bronze_usgs_events.sql#L1-L9)

## Why this choice

No ADR records this decision, so the reasons come from the workflow's comments and the warehouse README. The `lake` target is what Dagster runs, so a test on it is a test of what ships. The orchestration project's lockfile is the environment because that is where dbt-duckdb lives and what the image runs. A temporary directory stands in for R2 and Postgres, so the check needs no secret and cannot touch an environment.

[Source: ci.yml](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L175-L184) · [Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L52-L59)

The trade-off is that a fixture only proves what its rows exercise. The README says so directly: a fixture row that breaks a test fails the check, but the fixture has to be edited to reach a new case.

[Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L62-L63)

## How it has worked

The check went green on 2026-11-07 with `PASS=33`, and the commit that turned it green also ticked "`dbt test` in CI" on the roadmap. The pull request was built in a deliberate order. Its first commit carried a fixture row with a null magnitude, meant to show the step failing, and its message says "deliberately red". The step itself arrived in a later commit. A third commit gave that row a magnitude of 8.2. Its message records both outcomes locally: `PASS=33` with the row fixed, and with the null back, `not_null_fct_earthquakes_magnitude` fails and dbt exits 1.

[Source: roadmap, M3](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L280-L284) · [Source: commit 8cec740](https://github.com/FilipeFantini/lagom/commit/8cec740cd3de90acb15ff5af463567031673a16d) · [Source: commit d2d3523](https://github.com/FilipeFantini/lagom/commit/d2d3523f9e933e57feea2114241be68b2619bc09) · [Source: commit 9088716](https://github.com/FilipeFantini/lagom/commit/9088716d72816e159568f06343e7ed287793bb65)

The commit messages do not say whether CI itself turned red on that first commit, only that it was meant to.

## Gotchas

- **What it cannot see.** The `gold_reader_privileges` test needs a Postgres role, and the project enables it on the Postgres target only, so CI skips it. Freshness is not run either. [Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L65-L67)
- **Real data can still surprise it.** A column that dlt adds, renames or retypes reaches the fixture only when someone edits it, so the first proof of such a change is the next run in staging. [Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L67-L71)
- **One row has a status in capitals.** The fixture comment says it is "as network pt sends it". On 2026-10-27, before this check existed, three events with their status in capitals made a dbt test stop every run of the pipeline for about 90 minutes. [Source: fixture](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/ci/bronze_usgs_events.sql#L7) · [Source: ADR-0018](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L11-L13)
- **A name that no longer says what the job does.** The job still carries the name "warehouse (lint, parse)", although it now builds and tests too, because that name is a required check on `main`. A comment in the workflow says so. [Source: ci.yml](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L149-L152)
- **A test that cannot pass silently.** The fixture loader fails loudly if the load leaves bronze empty, and the commit that turned the check green also fixed a fixture header that named a row that does not exist. [Source: load_fixture.py](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/ci/load_fixture.py#L34-L37) · [Source: commit 9088716](https://github.com/FilipeFantini/lagom/commit/9088716d72816e159568f06343e7ed287793bb65)
- **Partial parsing can cross targets.** dbt can carry one target's result into the other, and the CI build passes `--no-partial-parse`. [Source: ci.yml](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L193-L195) · [Source: warehouse README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L126-L127)
