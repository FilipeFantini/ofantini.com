---
title: "A dashboard rebuilt after every pipeline run"
summary: "How the earthquake board went from a tool comparison to a static page that Dagster renders, checks against gold and publishes after each run, with credentials that can only read."
project: lagom
track: visualization
order: 1
lagom_commit: 40985495267cd7075ad332d1d130b03bd85d1546
adrs: ["0040", "0042", "0044"]
---

The board is live at [lagom.ofantini.com](https://lagom.ofantini.com/earthquakes.html): the earthquakes of the last 30 days, rebuilt from the lake after every pipeline run. It is one HTML file with no server behind it, and every number on it was compared with the warehouse before it was published.

## What was needed

A few public dashboards of public data, written as code and reviewed in pull requests, rebuilt after each run and served as static files, with nothing resident on the node. One rule ranks above the rest: a wrong number must fail a build, not ship.

[Source: the dbt Charts decision](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L47-L63)

## Choosing the tool

Evidence was the first choice, and it did not hold up against the lake. Its npm release had not moved since February 2026, the DuckDB inside it refused a DuckLake 1.0 catalog, telemetry was on by default, and `npm audit` reported 36 findings, 7 of them critical. It would also have put a Node toolchain beside a Python platform.

[Source: the dbt Charts decision, context](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L25-L45)

dbt Charts took its place: boards are YAML beside the warehouse project, queries are SQL over the dbt models through `ref()`, and the output is one self-contained HTML file. The price is a beta tool with pre-1.0 syntax, and a static page cannot filter, so every cut of the data is a chart of its own.

[Source: the dbt Charts decision](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L85-L104) · [Source: its costs](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L122-L131)

There was a detour. For a few days the plan was a dashboard server of the project's own, reading a serving layer in Postgres, with filters. When the question became what it added over dbt Charts, the one answer was live data, and that part was not built. The server stopped, and the static page became the target again.

[Source: the return to dbt Charts](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0042-the-dashboards-return-to-dbt-charts.md#L18-L36)

## A wrong number fails the build

`dct render` exits 0 when a query returns no rows, so a broken board can render without complaint. A separate check closes that gap: after every render, `check_boards.py` compares every column the board draws with what gold holds over the same window, and fails on an empty query. CI runs it on a fixture lake in every pull request, and the cluster runs it on the real lake before anything is published.

[Source: the dbt Charts decision, decision 4](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L105-L109) · [Source: the gap it closes](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L130-L133)

## One run, five steps

A Dagster job, `dashboards`, runs after each successful pipeline run: a sensor watches for the `usgs` job's success and requests one render. Both jobs carry the same concurrency tag, so the run queue never runs them side by side and the node's memory budget does not change. The step validates the boards against the lake, renders them, checks them against gold, checks the watermark, and uploads the pages, stopping at the first failure. Stale pages are deleted only after the last upload, so a failure halfway leaves the old set online.

[Source: what the publishing decisions became](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L196-L226) · [Source: publish()](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/platform/orchestration/lagom_orchestration/dashboards.py#L280-L290)

The watermark is a line at the top of the page, "Page built at" and the UTC time, printed by dbt Charts itself. The step refuses a page where it is missing, appears twice, or shows a time that is not now. The data's own freshness is the first line under the title, so a reader sees both clocks.

[Source: the watermark](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L237-L240) · [Source: the board's timestamp](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/products/dashboards/charts/earthquakes.yml#L22-L24)

## Credentials that can only read

The render reads a public dataset and writes nothing, yet it runs a tool the project does not control, and DuckDB repeats the catalog's connection string, password included, when an attach fails. Until this change every run Pod inherited every secret of the code server. Now each job names the Secrets its Pod gets, in its own tag.

[Source: the per-job credentials decision, context](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L24-L38)

The render's Pod gets a read-only Postgres role, limited to 3 connections, whose password libpq reads from `PGPASSWORD` instead of the connection string. It gets a read-only token on the lake's bucket and a token limited to the dashboards bucket. `dct` itself runs with a short list of variables, without the bucket's token or the alarm's address.

[Source: the read-only role](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L119-L125) · [Source: the job's environment](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L196-L211) · [Source: what the tool sees](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L227-L236)

The pages go to an R2 public bucket on a custom domain rather than Cloudflare Pages, for one reason: an R2 token can be limited to one bucket, so a leak from the render step cannot reach anything else in the account.

[Source: the publishing decision](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0044-per-job-credentials-and-the-dashboards-publishing-path.md#L157-L166)

## The first day in staging

The first run failed. `dct render` runs 8 query workers by default, each on its own connection, and the role allows 3: "too many connections for role". The error printed the connection string without a password, which is the defence above doing its job. The fix was one worker: DuckDB runs the queries one at a time anyway, so it costs no time.

[Source: the connection limit](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/architecture.md#L593-L597) · [Source: the render's workers](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/platform/orchestration/lagom_orchestration/dashboards.py#L80-L86)

The second finding was on the map: every circle looked the same size. The size scale starts at zero, so the areas of a magnitude 4 and a magnitude 7 differ by less than a factor of two. The circles are now sized by the square of the magnitude minus 3, so a magnitude 7 is about four times as wide as a magnitude 4.

[Source: the circle size](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/products/dashboards/charts/earthquakes.yml#L171-L177)

The third was about measuring. The render's Pod lives less than a minute, and the cluster's metrics sample once a minute, so watching it showed nothing. The step now reads the container's peak memory from the kernel and writes it to the run's log.

[Source: the memory peak](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/platform/orchestration/lagom_orchestration/dashboards.py#L109-L114)

## What it costs

The page is static: no filters, no search, no zoom on the map. dbt Charts is beta, its development happens upstream in a mirror that accepts no pull requests, and the exact version pin is the only defence against a breaking release. A board's numbers are only as well checked as the comparisons written for it: a new chart is unchecked until its comparison is added.

[Source: the dbt Charts decision, costs](https://github.com/FilipeFantini/lagom/blob/40985495267cd7075ad332d1d130b03bd85d1546/docs/adr/0040-dbt-charts-for-the-dashboards.md#L122-L133)
