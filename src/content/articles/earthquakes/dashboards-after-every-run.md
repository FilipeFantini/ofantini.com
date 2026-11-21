---
title: "An earthquake dashboard rebuilt after every run"
summary: "The live earthquake board and how to read it, then how Dagster renders it, checks it against gold and publishes it after each run, with credentials that can only read."
project: lagom
subproject: earthquakes
kind: report
order: 2
published: 2026-11-15
updated: 2026-11-21
adrs: ["0040", "0042", "0044"]
---

The board is live at [lagom.ofantini.com](https://lagom.ofantini.com/earthquakes.html): the earthquakes of the last 30 days, rebuilt from the lake after every pipeline run. It is one HTML file with no server behind it, and every number on it was compared with the warehouse before it was published.

<figure class="live-board">
<iframe src="https://lagom.ofantini.com/earthquakes_short.html" title="The earthquake board, live: the last 30 days of earthquakes, rebuilt after every pipeline run" sandbox="allow-scripts" referrerpolicy="no-referrer" loading="lazy"></iframe>
<figcaption>The board, live from Lagom: point at a bar or a circle for its figures. <a href="https://lagom.ofantini.com/earthquakes.html">Open the full dashboard</a>, with the table of the largest earthquakes.</figcaption>
</figure>

## How to read the board

The numbers change with every run; the patterns below do not.

**Small earthquakes vastly outnumber large ones.** The magnitude chart falls steeply from left to right: each step down in magnitude brings roughly ten times as many earthquakes, a property of the Earth, not of the window. Worldwide, strong earthquakes (magnitude 6 to 7) come about a dozen times a month and major ones (7 or more) about once a month, so some months have none.

**Most earthquakes are shallow**, above 70 km, where the brittle crust breaks. Intermediate and deep ones happen almost only where one tectonic plate dives under another, such as the western Pacific and South America.

**The regions chart and the map answer different questions.** The regions chart counts every recorded earthquake, and small ones are recorded mostly where seismic networks are dense, as in the United States, so Alaska and California usually lead it. The map shows only magnitude 4.0 and above, detected anywhere, so it draws the plate boundaries, such as the ring around the Pacific. The first shows where earthquakes are measured, the second where the Earth moves.

**The daily chart has spikes on a steady floor.** A spike usually follows a large earthquake and its aftershocks, or a swarm of small ones. The last bar is the current UTC day, so it is always short.

**Recent numbers are provisional.** The newest earthquakes are automatic solutions, reviewed by USGS analysts over the following days, and a review can change a magnitude and its class. So the page gives the latest revision time beside the latest earthquake.

[Source: the magnitude and depth classes](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/platform/warehouse/README.md#L25-L27)

## Requirements

Public dashboards of public data, written as code and reviewed in pull requests, rebuilt after each run and served as static files, with nothing resident on the node. Above all, a wrong number must fail a build, not ship.

[Source: the dbt Charts decision](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L47-L63)

## Choosing the tool

Evidence was the first choice and did not hold up: its npm release had not moved since February 2026, its DuckDB refused a DuckLake 1.0 catalog, telemetry was on by default, `npm audit` reported 36 findings (7 critical), and it would have put a Node toolchain beside a Python platform.

[Source: the dbt Charts decision, context](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L25-L45)

dbt Charts took its place: boards are YAML beside the warehouse project, queries are SQL over the dbt models through `ref()`, and the output is one self-contained HTML file. The price is a beta tool with pre-1.0 syntax, and a static page cannot filter, so every cut of the data needs its own chart.

[Source: the dbt Charts decision](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L85-L104) · [Source: its costs](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L122-L131)

A dashboard server with filters was planned for a few days. Its only gain over dbt Charts was live data, which was never built, so the server was stopped and the static page became the target again.

[Source: the return to dbt Charts](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0042-the-dashboards-return-to-dbt-charts.md#L18-L36)

## A wrong number fails the build

`dct render` exits 0 when a query returns no rows, so a broken board renders without complaint. `check_boards.py` closes that gap after every render: it compares every column the board draws with what gold holds over the same window, and fails on an empty query. It runs on a fixture lake in CI and on the real lake in the cluster before anything is published.

[Source: the dbt Charts decision, decision 4](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L105-L109) · [Source: the gap it closes](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L130-L133)

## One run, five steps

A Dagster sensor starts the `dashboards` job after each successful `usgs` run. Both jobs share a concurrency tag, so they never run side by side and the memory budget does not change. The step validates the boards against the lake, renders them, checks them against gold, checks the watermark and uploads the pages, stopping at the first failure. Stale pages are deleted only after the last upload, so a failure halfway leaves the old set online.

[Source: what the publishing decisions became](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L196-L226) · [Source: publish()](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/platform/orchestration/lagom_orchestration/dashboards.py#L280-L290)

The watermark, "Page built at" and the UTC time, is printed by dbt Charts at the top of the page; a page where it is missing, doubled or not current is refused. The data's own freshness is the first line under the title, so a reader sees both clocks.

[Source: the watermark](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L237-L240) · [Source: the board's timestamp](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/products/dashboards/charts/earthquakes.yml#L22-L24)

## Credentials that can only read

The render writes nothing, but it runs a tool the project does not control, and DuckDB repeats the catalog's connection string, password included, when an attach fails. Every run Pod used to inherit every secret of the code server; now each job names, in its own tag, the Secrets its Pod gets.

[Source: the per-job credentials decision, context](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L24-L38)

The render's Pod gets a read-only Postgres role limited to 3 connections, whose password libpq reads from `PGPASSWORD`, not from the connection string; a read-only token on the lake's bucket; and a token limited to the dashboards bucket. `dct` itself runs without the bucket's token or the alarm's address.

[Source: the read-only role](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L119-L125) · [Source: the job's environment](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L196-L211) · [Source: what the tool sees](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L227-L236)

The pages go to a public R2 bucket on a custom domain rather than Cloudflare Pages, because an R2 token can be limited to one bucket, so a leak from the render step cannot reach the rest of the account.

[Source: the publishing decision](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L157-L166)

## The first day in staging

The first run failed: `dct render` opens 8 query workers by default, each on its own connection, and the role allows 3. The error printed the connection string without a password, so the defence above held. The fix was one worker, which costs no time because DuckDB runs the queries one at a time anyway.

[Source: the connection limit](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/architecture.md#L593-L597) · [Source: the render's workers](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/platform/orchestration/lagom_orchestration/dashboards.py#L80-L86)

On the map, every circle looked the same size: the size scale starts at zero, so a magnitude 4 and a magnitude 7 differ in area by less than a factor of two. Circles are now sized by the square of the magnitude minus 3, so a magnitude 7 is about four times as wide as a magnitude 4.

[Source: the circle size](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/products/dashboards/charts/earthquakes.yml#L171-L177)

The render's Pod lives less than a minute and the cluster's metrics sample once a minute, so its memory went unmeasured. The step now reads the container's peak memory from the kernel and writes it to the run's log.

[Source: the memory peak](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/platform/orchestration/lagom_orchestration/dashboards.py#L109-L114)

## What it costs

The page is static: no filters, search or map zoom. dbt Charts is beta, developed upstream in a mirror that accepts no pull requests, so the exact version pin is the only defence against a breaking release. A new chart is unchecked until a comparison is written for it.

[Source: the dbt Charts decision, costs](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L122-L133)
