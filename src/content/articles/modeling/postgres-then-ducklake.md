---
title: Postgres first, then DuckLake
summary: "Why Lagom began with Postgres for every warehouse layer, and the proposed move to DuckLake."
project: lagom
track: modeling
order: 1
lagom_commit: 3d6039735d0ffca19553c1669d506f34da241a68
adrs: ["0008", "0023"]
---

A data platform needs a place to store records and a way to turn them into tables people can use. Lagom began with Postgres for every warehouse layer. That kept the first version small: one SQL dialect, one backup that covered every layer, and no other storage system to run until a measured limit called for one.

## A different division of work

The proposed next design uses DuckLake for tables: the data sits in Parquet files on object storage, while Postgres keeps the catalog describing those files. DuckDB reads and transforms the data.

![Flowchart showing how earthquake data becomes modeled tables](/diagrams/modeling.svg)

## A proposal still being measured

ADR-0023 remains proposed. USGS already runs on DuckLake, but the wider warehouse decision depends on the spike comparing memory, time and the rest of the workflow. Keeping Postgres in the design also means its catalog needs protection and backups.

[Source: ADR-0008](https://github.com/FilipeFantini/lagom/blob/3d6039735d0ffca19553c1669d506f34da241a68/docs/adr/0008-postgres-for-all-layers.md#L64-L108) · [Source: ADR-0023](https://github.com/FilipeFantini/lagom/blob/3d6039735d0ffca19553c1669d506f34da241a68/docs/adr/0023-sme-stack-duckdb-on-ducklake.md#L35-L92) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/3d6039735d0ffca19553c1669d506f34da241a68/docs/roadmap.md#L27-L28)
