---
title: "Testing dbt models in CI on fixture data"
summary: "How each pull request builds and tests the warehouse models on a throwaway DuckLake, why the first version was red on purpose, and what it still cannot see."
project: lagom
group: modeling
order: 2
published: 2026-11-09
updated: 2026-11-21
adrs: ["0018"]
---

A change to a data model can be valid SQL and still give wrong numbers. For a while the checks on a pull request (a proposed change) in Lagom proved that the models parsed, not that they produced the right tables. The aim was that proof before the merge, without credentials, real data or a database server.

[Source: the workflow before this change](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L160-L167)

## How it works

A CI job (continuous integration: the checks on every pull request) called `warehouse` runs on GitHub's machines, at no cost to the node. It lints the SQL, parses the dbt project, then runs `dbt build` on the `lake` target, the one Dagster uses in staging and prod, over a small hand-made bronze table.

[Source: the workflow](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L149-L195)

![Flowchart: a pull request starts the CI job, which lints and parses, loads 12 hand-made bronze rows into a temporary DuckLake on the runner's disk, runs dbt build on the lake target with models, contracts, unit tests, data tests and reconciliations, and ends in a green or red check.](/diagrams/modeling-dbt-in-ci.svg)

A script loads the fixture, a SQL file of 12 rows, into a DuckLake in a temporary directory on the runner. Nothing reaches R2 or Postgres, so no secret is needed. The build runs the models, the contracts (column names and types checked before a table is written), unit tests, data tests and reconciliations between layers, on the same dbt and DuckDB versions as production.

[Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L52-L63) · [Source: the workflow](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L175-L200)

Each of the 12 rows reaches a rule: two revisions of one event, every magnitude and depth class, a quarry blast that belongs in silver but not gold, a status in capitals, a place with no comma, and an event after midnight UTC that adds a second day to the daily aggregate.

[Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L60-L63) · [Source: the fixture](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/ci/bronze_usgs_events.sql#L1-L9)

## The trade-off

A fixture proves only what its rows exercise. A column that dlt adds, renames or retypes reaches the fixture only when someone edits it, so the first proof of such a change is the next run in staging.

[Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L62-L63) · [Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L67-L71)

The check went green on 2026-11-07 with `PASS=33`. The pull request's first commit carried a fixture row with a null magnitude to show the step failing; the commit messages record that failure locally, not whether CI turned red.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L280-L284) · [Source: the deliberately red commit](https://github.com/FilipeFantini/lagom/commit/8cec740cd3de90acb15ff5af463567031673a16d) · [Source: the commit that turned it green](https://github.com/FilipeFantini/lagom/commit/9088716d72816e159568f06343e7ed287793bb65)

## Details

Why each part was chosen, what the check cannot see, the row in capitals, the job's old name, the loader that refuses an empty table and partial parsing across targets:

[Source: the workflow](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L175-L184) · [Source: warehouse README, CI](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L65-L67) · [Source: the heartbeat decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L11-L13) · [Source: the workflow](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L149-L152) · [Source: the fixture loader](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/ci/load_fixture.py#L34-L37) · [Source: warehouse README](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/warehouse/README.md#L126-L127)
