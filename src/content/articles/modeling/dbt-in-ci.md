---
title: "Testing every dbt change on twelve made-up rows"
summary: "How each pull request builds and tests the warehouse models on a throwaway DuckLake, why the first version was red on purpose, and what it still cannot see."
project: lagom
group: modeling
order: 2
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0018"]
---

A change to a data model can be valid SQL and still give wrong numbers. For a while the checks on a pull request (a proposed change) in Lagom could tell that the models parsed, but not that they produced the right tables. Running tests on every change is standard practice. What I wanted to find out was how cheaply it could be done: the proof before the merge, without credentials, without real data and without a database server.

[Source: the workflow before this change](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L160-L167)

## How it works

One job in the CI workflow (continuous integration, the checks that run on every pull request), called `warehouse`, runs on GitHub's machines, so it costs the node nothing. It lints the SQL, parses the dbt project, then runs `dbt build` on the `lake` target, the target Dagster runs in staging and prod, over a small hand-made bronze table.

[Source: the workflow](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L149-L195)

![Flowchart: a pull request starts the CI job, which lints and parses, loads 12 hand-made bronze rows into a temporary DuckLake on the runner's disk, runs dbt build on the lake target with models, contracts, unit tests, data tests and reconciliations, and ends in a green or red check.](/diagrams/modeling-dbt-in-ci.svg)

A script loads the fixture, a SQL file of 12 rows, into a DuckLake whose catalog and Parquet files sit in a temporary directory on the runner. Nothing reaches R2 or Postgres, so the check needs no secret. The build runs the models, the contracts (column names and types checked before a table is written), the unit tests, the data tests and the reconciliations between layers, with the same dbt and DuckDB versions as the production image.

[Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L52-L63) · [Source: the workflow](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L175-L200)

The 12 rows are chosen so that each rule is reached: two revisions of one event, every magnitude and depth class, a quarry blast that belongs in silver but not gold, a status in capitals, a place with no comma, and an event after midnight UTC that makes a second day in the daily aggregate.

[Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L60-L63) · [Source: the fixture](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/ci/bronze_usgs_events.sql#L1-L9)

## The trade-off

A fixture only proves what its rows exercise: a fixture row that breaks a test fails the check, but the fixture has to be edited to reach a new case. A column that dlt adds, renames or retypes reaches the fixture only when someone edits it, so the first proof of such a change is the next run in staging.

[Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L62-L63) · [Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L67-L71)

The check went green on 2026-11-07 with `PASS=33`. The pull request's first commit carried a fixture row with a null magnitude, meant to show the step failing; the commit messages record that failure locally, not whether CI itself turned red.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L280-L284) · [Source: the deliberately red commit](https://github.com/FilipeFantini/lagom/commit/8cec740cd3de90acb15ff5af463567031673a16d) · [Source: the commit that turned it green](https://github.com/FilipeFantini/lagom/commit/9088716d72816e159568f06343e7ed287793bb65)

## Details

Why each part was chosen, what the check cannot see, the row in capitals, the job's old name, the loader that refuses an empty table and partial parsing across targets:

[Source: the workflow](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L175-L184) · [Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L65-L67) · [Source: the heartbeat decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L11-L13) · [Source: the workflow](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L149-L152) · [Source: the fixture loader](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/ci/load_fixture.py#L34-L37) · [Source: warehouse README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L126-L127)
