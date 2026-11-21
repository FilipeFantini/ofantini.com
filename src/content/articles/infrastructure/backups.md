---
title: "Database backups and rebuilding the node from Git"
summary: "Why the database backup waited until it protected something, how it was built the next day, and how the node was rebuilt from Git in a drill."
project: lagom
group: infrastructure
order: 4
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0019", "0025", "0027"]
---

Whatever lives only on a server dies with it. At first nothing on this one did, so backups were postponed until a written trigger fired, a day later.

## How it works

Postgres runs in the cluster under CloudNativePG, an operator (a program that manages a database). Two copies go to Cloudflare R2, object storage off the node: the write-ahead log (WAL), the journal Postgres writes before any change, at least once an hour, and a full base backup daily at 03:00 UTC. A restore replays the WAL on a base backup, so at most about one hour of writes is lost: the recovery point objective (RPO).

[Source: backup docs](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1601-L1612)

The Barman Cloud plugin makes the copies, as a sidecar container (a helper next to the main one) in each Postgres pod, with one bucket and one scoped token per environment.

[Source: the backup decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0025-postgres-backup-barman-cloud-to-r2.md#L36-L49)

The other half of recovery is the runbook. Everything the cluster runs is in Git, so a lost node is rebuilt in order: provision a server, join the private network, install k3s and Argo CD, restore the sealing key for secrets, apply the root Application, run the pipeline.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1862-L1890)

![Timeline of the backup decision: deferred on 2026-10-27, built and the node rebuilt on 2026-10-28, retention verified and WAL made hourly on 2026-11-05, old node deleted on 2026-11-07](/diagrams/infrastructure-backups.svg)

## The trade-off

The backup was deferred because an audit found nothing in Postgres that existed only on the node, and any backup adds an account, a credential and a schedule. Two checkable triggers were set instead: state no source can rebuild, or someone other than the operator relying on the data. The first fired the next day: Dagster's run history exists only on the node.

[Source: the deferral](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0019-postgres-backup-deferred.md#L20-L36) · [Source: the deferral](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0019-postgres-backup-deferred.md#L47-L68) · [Source: the backup decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0025-postgres-backup-barman-cloud-to-r2.md#L15-L28)

The hour is an accepted loss. WAL segments were first closed every 5 minutes, so the archive grew with the clock, not the data; the timeout was raised to one hour, moving the RPO from about 5 minutes to about 1 hour.

[Source: the hourly decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0027-hourly-wal-archiving-and-14-day-prod-retention.md#L11-L37)

A restore in staging was ready in 68 seconds. The rebuild drill took 20 min 31 s from the first command on the node to prod's first green run, excluding provisioning. It re-loaded from the source instead of restoring from the buckets, which brings back only the last 30 days of earthquakes.

[Source: backup notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0025-postgres-backup-barman-cloud-to-r2.md#L109-L122) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1853-L1860) · [Source: deferral notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0019-postgres-backup-deferred.md#L114-L129)

## Details

Retention, the archive's cost, why prod was enabled before the last check, how two clusters hide each other's failures, and the drill's gaps:

[Source: backup notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0025-postgres-backup-barman-cloud-to-r2.md#L129-L139) · [Source: the hourly decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0027-hourly-wal-archiving-and-14-day-prod-retention.md#L65-L70) · [Source: backup notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0025-postgres-backup-barman-cloud-to-r2.md#L121-L128) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1895-L1904) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1948-L1966) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1907-L1926)
