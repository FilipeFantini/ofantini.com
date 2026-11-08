---
title: One Dagster per environment
project: lagom
track: orchestration
lagom_commit: 3d6039735d0ffca19553c1669d506f34da241a68
adrs: ["0026"]
---

A pipeline needs more than a sequence of commands: someone must schedule it, see what happened and know when it failed. Dagster coordinates that work in Lagom.

## Separate places to run

Staging is the rehearsal space; production is where the real pipeline runs. Each has its own Dagster instance and its own Postgres metastore, which records the history of runs. Changes can be exercised in staging before they reach production.

![Flowchart showing the orchestration of data jobs](/diagrams/orchestration.svg)

## The cost of isolation

One shared instance would use less resident memory, but it would cross the boundary between environments. The accepted design spends more resources to keep that boundary clear.

[Source: ADR-0026](https://github.com/FilipeFantini/lagom/blob/3d6039735d0ffca19553c1669d506f34da241a68/docs/adr/0026-dagster-one-instance-per-environment.md#L30-L66)

Dagster coordinates dlt and dbt in each environment; it does not replace their roles. Collection, transformation and scheduling remain distinct pieces.
