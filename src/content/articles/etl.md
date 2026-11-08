---
title: "The USGS pipeline: from events to useful data"
project: lagom
track: etl
lagom_commit: 3d6039735d0ffca19553c1669d506f34da241a68
adrs: ["0026"]
---

Earthquake records are useful only if they can be collected, checked and reshaped into something people can query. The USGS pipeline follows that path with public data.

## From source to models

dlt retrieves events from the USGS API and loads them into DuckLake. DuckLake keeps the table catalog in Postgres and its data files in object storage. dbt then builds and checks the models, while Dagster coordinates the work.

![Flowchart showing the earthquake data pipeline](/diagrams/etl.svg)

## A recorded run

The first production run loaded 10,042 events covering 30 days and reported PASS=33. These are results of that run, not a promise about future volumes or performance.

[Source: roadmap, M3](https://github.com/FilipeFantini/lagom/blob/3d6039735d0ffca19553c1669d506f34da241a68/docs/roadmap.md#L263-L265)

The design keeps the source-specific collection separate from the shared tools. Adding a source still takes work, but it can use the same foundation.
