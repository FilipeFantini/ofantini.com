---
title: "Two Dagsters, one image, and a change that always visits staging first"
summary: "Why staging and production each run their own Dagster, how one image reaches production by digest only after staging, and what the first weeks of running it measured."
project: lagom
group: orchestration
order: 1
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0007", "0014", "0015", "0026"]
---

A pipeline needs someone to schedule it, show what happened and keep its history. The harder question is where a change is tried before it can hurt real data. Trying it in staging first is standard practice; what I wanted to see is whether two full environments fit on one small machine.

## How it works

**Dagster** is the orchestrator: it holds the schedule, starts runs and records each run's history. One runs per environment, each in its own namespace (a walled-off area of Kubernetes, the system that runs everything on the node). Its history lives in a database called `dagster` in that environment's Postgres.

[Source: the Dagster decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L47-L54)

Three Pods stay up. (A Pod is the smallest thing Kubernetes runs: one or more containers together.) The webserver is the UI. The daemon evaluates schedules and starts queued runs. The code server loads the code and answers the other two. A run is none of them: the daemon creates a Kubernetes Job for it, and the Job is deleted an hour after it finishes.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1723-L1736)

**Promotion** is by image **digest**, the hash that names one exact image. CI (the checks that run on every change) builds the image on a push to `main`. Staging and production each pin their own digest, so a change takes three pull requests: the code, then a pin in staging, then the same digest in prod. A CI check fails a change whose prod manifests pin a digest staging had not pinned first. It proves "pinned first", not "ran successfully", so the staging run is confirmed by hand before the prod pull request opens.

![Flowchart: a merge to main makes CI build an image, a pull request pins its digest in staging, staging's Dagster runs it, and only then does a second pull request pin the same digest in prod. A CI check asks whether staging pinned the digest first. The developer's laptop works only against the lagom_dev database in staging.](/diagrams/orchestration-dagster-per-environment.svg)

[Source: the image decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L54-L72) · [Source: architecture, environments](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L342-L350) · [Source: the image decision, note](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L126-L131)

## The trade-off

The first decision about environments said staging would run no Dagster, because the orchestrator was the heavy component on a 4 GB node. Once the node had 8 GB, that part was reversed. One Dagster for both would save memory, but each run writes straight to Dagster's metadata database, so a staging run could write into prod's history. The price is about 550 MiB of resident requests per environment.

[Source: the environments decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0007-three-environments.md#L65-L82) · [Source: the Dagster decision, header](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L10-L12) · [Source: the Dagster decision, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L28-L43) · [Source: the Dagster decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L85-L90)

It paid off at once. In staging's first week, 372 of 373 pipeline runs succeeded, and staging caught a memory plan that was wrong: a run measured about 700 MiB where I had budgeted 250 to 300. Each job now carries its own resources, found before production.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L252-L256) · [Source: the Dagster decision, note](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L116-L131)

## Details

Development against staging, the first-day failures, why runs start from the job page, and how the UI's access changed:

[Source: the development decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0014-develop-against-staging.md#L44-L62) · [Source: the development decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0014-develop-against-staging.md#L30-L40) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1807-L1824) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1826-L1831) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1833-L1837) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1801-L1805) · [Source: the Dagster decision, notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L132-L142)
