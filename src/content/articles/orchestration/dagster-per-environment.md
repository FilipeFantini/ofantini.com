---
title: "Two Dagsters, one image, and a change that always visits staging first"
summary: "Why staging and production each run their own Dagster, how one image reaches production by digest only after staging, and what the first weeks of running it measured."
project: lagom
track: orchestration
order: 1
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0007", "0014", "0015", "0026"]
---

A pipeline needs someone to schedule it, show what happened and keep its history. The harder question is where a change is tried before it can hurt real data. Trying it in staging first is standard practice; what I wanted to see is whether two full environments fit on one small machine. This is how Lagom, my open-source data platform for one small machine, schedules its pipeline with Dagster, and how a change gets from my laptop to production without skipping staging.

## What I built

**Dagster** is the orchestrator: it holds the schedule, starts runs and records each run's history. I run one per environment, each in its own namespace (a walled-off area of Kubernetes, the system that runs everything on the node), built from the `dagster/dagster` chart (version 1.13.27). Each has a webserver, a daemon and one code location, and its runs are launched as Kubernetes Jobs in the same namespace. Its history lives in a database called `dagster` in that environment's Postgres, which is backed up with the rest of that Postgres Cluster.

[Source: the Dagster decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L47-L54)

Three Pods stay up. (A Pod is the smallest thing Kubernetes runs: one or more containers together.) The webserver is the UI. The daemon evaluates schedules and starts queued runs. The code server loads the code and answers the other two. A run is none of them: the daemon creates a Job named `dagster-run-<run id>`, whose Pod uses the code server's image, and the Job and its Pod are deleted an hour after they finish. The code is one image, `lagom-orchestration`, holding each service's assets and the dbt project.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1723-L1736) · [Source: the Dagster decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L55-L60)

**Developing** needs no local services. Code stays on my machine, and data lives in staging: its Postgres holds a database `lagom_dev`, reached by `kubectl port-forward` over the private network. A rule on the Postgres Cluster keeps the developer out of the database staging validates against.

[Source: the development decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0014-develop-against-staging.md#L44-L62)

**Promotion** is by image **digest**, the hash that names one exact image. CI (the checks that run on every change) builds the image on a push to `main`, tagged with the commit. Staging and production each pin their own digest, so a change takes three pull requests: the code, then a pin in staging, then the same digest in prod. CI helps: a check fails a change whose prod manifests pin a digest staging had not pinned on `main` first.

![Flowchart: a merge to main makes CI build an image, a pull request pins its digest in staging, staging's Dagster runs it, and only then does a second pull request pin the same digest in prod. A CI check asks whether staging pinned the digest first. The developer's laptop works only against the lagom_dev database in staging.](/diagrams/orchestration-dagster-per-environment.svg)

[Source: the image decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L54-L72) · [Source: architecture, environments](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L342-L350)

## Why this way

**Staging that shares a database with prod is theatre.** That sentence shaped my decision about environments: a pipeline that passes against prod data in a neighbouring namespace proves nothing. Staging therefore has its own Postgres, a quota, a network rule denying staging to prod, and separate secrets. The same decision said staging would run no Dagster, because the orchestrator was the heavy component on a 4 GB node. I listed the cost myself: a badly defined asset would surface first in prod.

[Source: the environments decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0007-three-environments.md#L22-L24) · [Source: the environments decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0007-three-environments.md#L65-L82) · [Source: the environments decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0007-three-environments.md#L97-L103)

A later decision reversed that part once the node had 8 GB, because the memory reason no longer held. I weighed two alternatives. One Dagster for both would save about 550 MiB, but each run is a Pod that writes events straight to Dagster's metadata database. The metadata would either sit in prod's Postgres, forcing its NetworkPolicy to open to staging, or in a third Postgres that a staging run could still use to write into prod's history. Dagster in prod only would let upgrades and asset changes reach prod untested. The price of my choice is about 550 MiB of resident requests per environment. That is what it costs to rehearse properly on a small machine.

[Source: the Dagster decision, header](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L10-L12) · [Source: the Dagster decision, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L28-L43) · [Source: the Dagster decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L85-L90)

The development setup was also a choice among rejected options. I rejected a local Postgres as a service to keep running. Developing inside staging's pipeline database would mean a green staging run no longer proves anything. A third Postgres Cluster would cost about 300 MiB resident for a few hours of use a week.

[Source: the development decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0014-develop-against-staging.md#L30-L40)

## How it's going

Staging's Dagster has run since 2026-10-28 and prod's since 2026-11-05, staging first. In staging's first week, 372 of 373 pipeline runs succeeded. The median run took 43 s and the longest 136 s. The one failure was the database-driver pitfall described under Gotchas.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L252-L256) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1748-L1752)

Staging also corrected my memory plan. I had budgeted a run at about 250 to 300 MiB. Staging measured a run at about 700 MiB, so a single shared figure would have reserved that much for the idle code server and prod would not have fitted the CI ceiling. Each job now carries its own resources and runs its steps in one process. Runs then peaked at 623 to 640 MiB in staging and 550 MiB in prod's first load of 30 days, and the request stays 768 MiB. Catching that before production is exactly what the second Dagster is for.

[Source: the Dagster decision, note](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L116-L131)

## Gotchas

- **Three first-day failures in staging, on 2026-10-28.** The image had an `ENTRYPOINT`, so the container ran `dagster dagster api grpc` and failed with `No such command 'dagster'`. Then psycopg 3 was missing, so the first schedule tick failed with `ModuleNotFoundError`. Then, with psycopg 3 installed, the first run failed in Dagster's run storage with `syntax error at or near "$1"`, because psycopg 3 sends parameters separately. One value in the chart's configuration selects psycopg2 without rebuilding the image. All three were found in staging, not prod. [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1807-L1824)
- **Prod's daemon and webserver restarted once on the first sync.** They started before CloudNativePG, the program that manages Postgres in the cluster, had created the `dagster` database, retried, exited and came up on the restart. A restart count of 1 is this; one that keeps rising is not. [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1826-L1831)
- **The first image pull took 4 min 25 s.** The image is 961 MiB. Until it ends the Pod shows `ContainerCreating`, which is not a failure. [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1833-L1837)
- **The promotion check proves less than it sounds.** It asserts "pinned on `main` first", not "ran successfully", because CI never reaches the cluster. I confirm the staging run myself before opening the prod pull request. [Source: the image decision, note](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L126-L131) · [Source: architecture, environments](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L342-L350)
- **Start runs from the job page.** A run started from the asset catalog belongs to Dagster's implicit asset job, which has none of the job's tags. The queue does not hold it back, so two loads could overlap on dlt's cursor, and it takes the code server's memory instead of the run's. [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1801-L1805)
- **The UI has no login.** Reaching it is the access control. The Dagster decision first chose `kubectl port-forward`. On 2026-11-05 a later decision replaced that with a URL reachable only from my devices, and a second one replaced it the same day with a Cloudflare Access login. [Source: the Dagster decision, notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L132-L142)
