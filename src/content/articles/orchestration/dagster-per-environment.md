---
title: "One Dagster per environment, and a change that visits staging first"
summary: "Why staging and prod each run their own Dagster, how the same image reaches prod by digest after staging, and what the first weeks of running it measured."
project: lagom
track: orchestration
order: 1
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0007", "0014", "0015", "0026"]
---

A pipeline needs someone to schedule it, show what happened and keep its history. The harder question is where a change is tried before it can hurt real data. If the first place a new job runs is production, the rehearsal never happened. This is how Lagom schedules its pipeline with Dagster, and how a change gets from a laptop to production without skipping staging.

## What we built: one Dagster per environment

**Dagster** is the orchestrator: it holds the schedule, starts runs and records each run's history. Lagom runs one per environment, each in its own namespace, built from the `dagster/dagster` chart (version 1.13.27). Each has a webserver, a daemon and one code location, and its runs are launched as Kubernetes Jobs in the same namespace. Its history lives in a database called `dagster` in that environment's Postgres, which is backed up with the rest of that Postgres Cluster.

[Source: ADR-0026](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L47-L54)

Three Pods stay up. The webserver is the UI. The daemon evaluates schedules and starts queued runs. The code server loads the code and answers the other two. A run is none of them: the daemon creates a Job named `dagster-run-<run id>`, whose Pod uses the code server's image, and the Job and its Pod are deleted an hour after they finish. The code is one image, `lagom-orchestration`, holding each service's assets and the dbt project.

[Source: runbook, Dagster](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1723-L1736) · [Source: ADR-0026](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L55-L60)

**Developing** needs no local services. Code stays on the operator's machine, and data lives in staging: its Postgres holds a database `lagom_dev`, reached by `kubectl port-forward` over the private network. A rule on the Postgres Cluster keeps the developer out of the database staging validates against.

[Source: ADR-0014](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0014-develop-against-staging.md#L44-L62)

**Promotion** is by image **digest**, the hash that names one exact image. CI builds the image on a push to `main`, tagged with the commit. Staging and prod each pin their own digest, so a change takes three pull requests: the code, then a pin in staging, then the same digest in prod. CI helps: a check fails a change whose prod manifests pin a digest staging had not pinned on `main` first.

![Flowchart: a merge to main makes CI build an image, a pull request pins its digest in staging, staging's Dagster runs it, and only then does a second pull request pin the same digest in prod. A CI check asks whether staging pinned the digest first. The developer's laptop works only against the lagom_dev database in staging.](/diagrams/orchestration-dagster-per-environment.svg)

[Source: ADR-0015](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L54-L72) · [Source: architecture, environments](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L342-L350)

## Why this choice: isolation has a price

**Staging that shares a database with prod is theatre.** That sentence shaped ADR-0007: a pipeline that passes against prod data in a neighbouring namespace proves nothing. Staging therefore has its own Postgres, a quota, a network rule denying staging to prod, and separate secrets. ADR-0007 also decided that staging would run no Dagster, because the orchestrator was the heavy component on a 4 GB node. It listed the cost itself: a badly defined asset would surface first in prod.

[Source: ADR-0007](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0007-three-environments.md#L22-L24) · [Source: ADR-0007, decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0007-three-environments.md#L65-L82) · [Source: ADR-0007, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0007-three-environments.md#L97-L103)

ADR-0026 reversed that part once the node had 8 GB, because the memory reason no longer held. It considered two alternatives. One Dagster for both would save about 550 MiB, but each run is a Pod that writes events straight to Dagster's metadata database. The metadata would either sit in prod's Postgres, forcing its NetworkPolicy to open to staging, or in a third Postgres that a staging run could still use to write into prod's history. Dagster in prod only would let upgrades and asset changes reach prod untested. The price of the choice is about 550 MiB of resident requests per environment.

[Source: ADR-0026, header](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L10-L12) · [Source: ADR-0026, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L28-L43) · [Source: ADR-0026, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L85-L90)

The development setup was also a choice among rejected options. A local Postgres was rejected by the operator as a service to keep running. Developing inside staging's pipeline database would mean a green staging run no longer proves anything. A third Postgres Cluster would cost about 300 MiB resident for a few hours of use a week.

[Source: ADR-0014](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0014-develop-against-staging.md#L30-L40)

## How it has worked: staging's first weeks

Staging's Dagster has run since 2026-10-28 and prod's since 2026-11-05, staging first. In staging's first week, 372 of 373 pipeline runs succeeded. The median run took 43 s and the longest 136 s. The one failure was the database-driver pitfall described under Gotchas.

[Source: roadmap, M3](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L252-L256) · [Source: runbook, Dagster](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1748-L1752)

Staging also corrected the memory plan. ADR-0026 had budgeted a run at about 250 to 300 MiB. Staging measured a run at about 700 MiB, so a single shared figure would have reserved that much for the idle code server and prod would not have fitted the CI ceiling. Each job now carries its own resources and runs its steps in one process. Runs then peaked at 623 to 640 MiB in staging and 550 MiB in prod's first load of 30 days, and the request stays 768 MiB.

[Source: ADR-0026, note](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L116-L131)

## Gotchas: first-day failures and limits

- **Three first-day failures in staging, on 2026-10-28.** The image had an `ENTRYPOINT`, so the container ran `dagster dagster api grpc` and failed with `No such command 'dagster'`. Then psycopg 3 was missing, so the first schedule tick failed with `ModuleNotFoundError`. Then, with psycopg 3 installed, the first run failed in Dagster's run storage with `syntax error at or near "$1"`, because psycopg 3 sends parameters separately. One value in the chart's configuration selects psycopg2 without rebuilding the image. All three were found in staging, not prod. [Source: runbook, Dagster](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1807-L1824)
- **Prod's daemon and webserver restarted once on the first sync.** They started before CloudNativePG had created the `dagster` database, retried, exited and came up on the restart. A restart count of 1 is this; one that keeps rising is not. [Source: runbook, Dagster](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1826-L1831)
- **The first image pull took 4 min 25 s.** The image is 961 MiB. Until it ends the Pod shows `ContainerCreating`, which is not a failure. [Source: runbook, Dagster](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1833-L1837)
- **The promotion check proves less than it sounds.** It asserts "pinned on `main` first", not "ran successfully", because CI never reaches the cluster. The operator confirms the staging run before opening the prod pull request. [Source: ADR-0015, note](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L126-L131) · [Source: architecture, environments](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L342-L350)
- **Start runs from the job page.** A run started from the asset catalog belongs to Dagster's implicit asset job, which has none of the job's tags. The queue does not hold it back, so two loads could overlap on dlt's cursor, and it takes the code server's memory instead of the run's. [Source: runbook, Dagster](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1801-L1805)
- **The UI has no login.** Reaching it is the access control. ADR-0026 first chose `kubectl port-forward`. On 2026-11-05 a later ADR replaced that with a URL reachable only from the operator's devices, and a second ADR replaced it the same day with a Cloudflare Access login. [Source: ADR-0026, notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0026-dagster-one-instance-per-environment.md#L132-L142)
