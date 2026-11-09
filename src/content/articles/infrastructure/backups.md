---
title: "The backup was postponed on purpose, then the whole server was rebuilt from a checklist"
summary: "Why the database backup waited until it protected something, how it was built the next day, and what rebuilding the node from Git taught me."
project: lagom
track: infrastructure
order: 4
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0019", "0025", "0027"]
---

A server can die, and whatever lived only on it dies too. So the first question about backups isn't how. It's whether anything on the server can't be rebuilt from somewhere else. For this platform the answer was no, so I postponed backups and wrote down the trigger that would change my mind. A day later it fired.

## What was built

The platform keeps its data in Postgres, which runs in the cluster under CloudNativePG, an operator (a program that manages a database for you). Two kinds of copy go to Cloudflare R2, an object store that lives off the node. The first is the write-ahead log (WAL), the journal Postgres writes before it changes any data. Each segment is uploaded when its 16 MiB fill, or after an hour at most. The second is a base backup, a full copy, taken every day at 03:00 UTC. A restore replays the WAL on top of a base backup, so it can reach any moment up to the last uploaded segment. At most about one hour of writes is lost. That figure is the recovery point objective (RPO).

[Source: backup docs](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1601-L1612)

The mechanism is the Barman Cloud plugin: a sidecar container (a helper that runs next to the main one) in each Postgres pod. There is one bucket per environment, and each bucket has its own token, scoped to that bucket and sealed in the cluster. Staging keeps 7 days of backups and prod keeps 14.

[Source: the backup decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0025-postgres-backup-barman-cloud-to-r2.md#L36-L49) · [Source: backup docs](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1596-L1599)

The other half of recovery is the checklist. Everything the cluster runs is in Git, so a lost node is rebuilt by following the runbook. The steps: provision a server, join the private network, install k3s (a small Kubernetes) and Argo CD (a program in the cluster that keeps it matching the repository), restore the sealing key for secrets, apply the root Application, then run the pipeline in staging and prod.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1862-L1890)

![Timeline of the backup decision: deferred on 2026-10-27, built and the node rebuilt on 2026-10-28, retention verified and WAL made hourly on 2026-11-05, old node deleted on 2026-11-07](/diagrams/infrastructure-backups.svg)

## Why this way

The backup was deferred because an audit found nothing in Postgres that existed only on the node. Raw events could be fetched again from USGS. The silver and gold layers are rebuilt from bronze by dbt, the tool that runs the SQL transformations. Roles live in manifests, and credentials are sealed in Git. I rejected building it anyway: even the cheapest form adds an account, a credential and a schedule that cost more than they protect. Waiting for a milestone was ruled out too, since Dagster's run history and a streaming source would then pile up unprotected. Instead, two triggers that anyone can check were set: Postgres holds state no source can rebuild, or someone other than me relies on the data.

[Source: the deferral](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0019-postgres-backup-deferred.md#L20-L36) · [Source: the deferral](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0019-postgres-backup-deferred.md#L47-L68)

The trigger fired the next day, because Dagster's run history is next and exists only on the node. Dagster is the orchestrator that runs the pipeline. The plugin won over a `pg_dump` job on a schedule. A dump is a snapshot, so anything written since the last run is lost, and the restore path would be something hand-written rather than something the database tooling already does.

[Source: the backup decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0025-postgres-backup-barman-cloud-to-r2.md#L15-L28)

## How it's going

In staging on 2026-10-28, WAL archiving to R2 worked, a base backup completed in 15 seconds, and a restore into a new database cluster was ready in 68 seconds. It held every row up to the last archived WAL. A pipeline run two minutes later was not archived yet.

[Source: backup notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0025-postgres-backup-barman-cloud-to-r2.md#L109-L122)

The retention check came on 2026-11-05. Staging's 7-day policy dropped the first backup that fell out of the window, the manual one from 2026-10-28, and the sidecar logged no error in 8 days.

[Source: backup notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0025-postgres-backup-barman-cloud-to-r2.md#L129-L139)

The rebuild ran as a drill on 2026-10-28, moving to a larger node with the old one still up. It took 20 min 31 s from the first command on the node to prod's first green run. About 6 minutes of that is the machine working; the rest is me reading results. It excludes provisioning, which went untimed, so a rebuild from nothing is about 50 minutes by estimate, not by measurement. The checklist for the old node says to power it off first and wait 24 hours, in which both heartbeat checks must stay up, before deleting it. The old node was deleted on 2026-11-07.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1853-L1857) · [Source: architecture](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L63-L64) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1907-L1926) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1970-L1974) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L228-L230)

## Gotchas

**The re-load could not rebuild everything.** "The re-load is untested" was already on the risk list. The drill found the cause: the USGS API filters by event origin time, so without a start time it returns only events from the last 30 days. The new prod held 3,952 events fewer than the old one. That limit was accepted the same day, so recovery by re-load means the last 30 days of events.

[Source: the deferral](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0019-postgres-backup-deferred.md#L91-L92) · [Source: deferral notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0019-postgres-backup-deferred.md#L114-L129)

**The drill tested a re-load, not a restore.** A rebuild that bootstraps each database from its bucket would also keep the event revisions a re-load loses, but I haven't run it. Until it runs, the re-load is the proven path.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1853-L1860)

**The archive grew with the clock, not with the data.** Eight days in, each bucket held about 1 GB, with little real data ingested. CloudNativePG sets a 5-minute archive timeout, so Postgres closes a WAL segment at least that often, and a segment closed early is still a full 16 MiB file. Staging's WAL position advanced by exactly 4,640 MiB a day, 290 segments, each gzipped to about 0.5 MB. The timeout moved to one hour and prod's retention was cut from 30 to 14 days. The trade-off is plain: the RPO went from about 5 minutes to about 1 hour. How much of those 0.5 MB is real change was not measured, and the notes record no result for that check.

[Source: the hourly decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0027-hourly-wal-archiving-and-14-day-prod-retention.md#L11-L37) · [Source: the hourly decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0027-hourly-wal-archiving-and-14-day-prod-retention.md#L65-L70) · [Source: the hourly decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0027-hourly-wal-archiving-and-14-day-prod-retention.md#L84-L87)

**Prod was enabled before the last check.** Retention can't show anything before backups are 7 days old, so I enabled prod's backup first, on this reasoning: a retention failure only grows the bucket, inside R2's free tier, and loses no data, while prod had no backup at all.

[Source: backup notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0025-postgres-backup-barman-cloud-to-r2.md#L121-L128)

**Two clusters at once hide each other's failures.** During a move, both nodes reconcile the same `main` and ping the same heartbeat checks, so a check that stays up proves nothing about the new node. The runbook says to judge the new node by its own runs, and to power the old one off as soon as the new one passes. The drill also recorded seven gaps and what changed for each, such as a kubeconfig command that overwrote the existing file.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1895-L1904) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1948-L1966)

## What's next

The lost hour is accepted for now. It gets revisited when a dataset that can't be re-loaded enters, the streaming-source trigger in the roadmap. Prod's first retention deletion was due around 2026-11-12.

[Source: the hourly decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0027-hourly-wal-archiving-and-14-day-prod-retention.md#L99-L101) · [Source: backup notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0025-postgres-backup-barman-cloud-to-r2.md#L147-L152)
