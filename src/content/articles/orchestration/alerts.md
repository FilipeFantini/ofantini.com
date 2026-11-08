---
title: "Raising the alarm when nothing happens"
summary: "How a missing ping turned a silent pipeline into an e-mail, and how Dagster's failure sensor and heartbeat replaced the CronJobs that first did the job."
project: lagom
track: orchestration
order: 2
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0018", "0033"]
---

On 2026-10-27 the USGS pipeline failed in both environments for about 90 minutes. Three events arrived with their status in capitals, and a test stopped every run. The failure was loud inside the cluster, yet nobody was told, and it was found because someone happened to look. Failing loudly only helps if the noise reaches a person, and a pipeline that never starts says nothing at all.

[Source: ADR-0018](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L9-L21)

## What we built

The node accepts no inbound connection, so a monitor that probes a URL from outside has nothing to probe. The answer turns the question around: the pipeline reports in, and silence is the alarm.

[Source: ADR-0018](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L23-L25)

**Step one, a heartbeat (2026-10-27).** Healthchecks.io is a service that expects a ping on a schedule. Each successful run pings a check, one per environment. If no ping arrives within the schedule plus a grace period, it e-mails the operator. The schedule is every 30 minutes with 20 minutes of grace, which makes the worst case from failure to e-mail about 50 minutes. The ping is an outbound HTTPS request, so no port opens.

[Source: ADR-0018, decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L63-L70) · [Source: ADR-0018, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L98-L99)

The ping had to follow success only. In the CronJob's Pod, the load and the transformation were init containers and the ping was a regular container. Kubernetes starts regular containers only when every init container exited 0, so a failed load or a failed dbt test meant no ping, enforced by Kubernetes rather than by a script.

[Source: ADR-0018, decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L72-L76)

**Step two, Dagster's sensors (2026-11-07).** A **sensor** is Dagster's watcher on run events. Two of them run in the code server, which already runs all the time, on the same check and the same Secret. One pings after each successful `usgs` run. The other calls the check's `/fail` endpoint for any failed run, with the job name, the run ID and the error in the body, cut to 10,000 bytes keeping its start and end. Healthchecks.io e-mails at once, and the next successful run clears it. The CronJobs were deleted in the same change.

![Sequence diagram: Dagster pings Healthchecks.io after each successful run; when the node stops and no ping arrives within the schedule plus the grace period, the operator gets an e-mail; when a run fails, Dagster calls /fail and the operator is e-mailed at once; the next successful run brings the check up again.](/diagrams/orchestration-alerts.svg)

[Source: ADR-0033, decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L73-L87) · [Source: ADR-0033, decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L106-L111)

## Why this choice

The two failures are different. A failed run can be reported at once, with its error. When the daemon, the node or the cluster is down, nothing inside the cluster can report anything. Native alerting answers the first and is silent on the second; a heartbeat answers the second, only after the schedule and grace have passed, and says nothing about why.

[Source: ADR-0033](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L31-L39)

For the heartbeat, ADR-0018 turned down an uptime monitor that polls a URL (nothing is reachable), and self-hosting Healthchecks or Uptime Kuma in the cluster, since the budget had about 220 MiB left and a monitor on the node it watches goes silent with it. It also turned down Grafana alerting (150 MB resident) and a Job that sends e-mail itself, which needs SMTP credentials in the cluster and sends nothing when a run never starts.

[Source: ADR-0018, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L37-L59)

ADR-0033 combined the two approaches rather than choosing one. Dagster's native alerting alone needs an SMTP or chat credential in the cluster. A success ping alone reports a failure up to about 50 minutes late and without the error. Retiring the CronJobs first and the alarm later would leave a window with no alarm, and the CronJob's check would e-mail a false "down" as soon as its pings stopped.

[Source: ADR-0033, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L50-L69)

The trade-off is accepted in writing. A third party sits in the alert path: if Healthchecks.io is down, alerts stop with it, silently. Its code is open source, so self-hosting it off the node is the exit.

[Source: ADR-0018, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L101-L108)

## How it has worked

The heartbeat was verified on 2026-10-27: staging on demand reported `heartbeat sent: HTTP 200`, and prod's 12:00 run showed `ingest`, `transform` and `heartbeat` all exiting 0, in 18 s. The free plan allows 20 checks and keeps 100 log entries per job, which is about 50 hours of runs at one ping every 30 minutes. Two checks are used.

[Source: roadmap, M2](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L202-L207) · [Source: ADR-0018, notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L135-L141)

The sensors followed on 2026-11-07, staging first. Staging passed a ping and a deliberate `/fail`, made by launching one run pointed at a database host that does not exist, so dlt fails before writing anything. Prod switched the same day, and its first ping came from Dagster at 21:01 UTC, after its CronJob was deleted. The operator decided not to wait for 2026-11-12, the date set earlier.

[Source: roadmap, M3](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L266-L275) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1356-L1368)

The grace period is a 20-minute estimate from only two samples. Staging's runs of 2026-11-07 at 15:30 and 16:00 UTC took 49 and 47 s, and the sensor evaluates every 30 s. The range is to be re-read from the run list after a week, and the grace corrected if a run comes near it.

[Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1325-L1331)

## Gotchas

- **The old ping could hide a new failure.** While a CronJob still ran, it pinged the same check, and its success would have cleared a Dagster `/fail`. Deleting the CronJobs was therefore part of the cutover. Argo CD's Postgres Applications never prune, so the deletion was done by hand right after the sync. [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1377-L1384)
- **Every run Pod holds the ping URL.** Whoever has it can silence the alarm. The chart copies the code server's whole environment into each run Pod with no way to leave one variable out. The operator accepted this on 2026-11-07, because run Pods already hold the catalog owner's password and the R2 write token. [Source: ADR-0033](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L88-L99)
- **An error message can carry a password.** DuckDB repeats the catalog URI, password included, when attaching the lake fails. The failure sensor removes URI passwords and DuckDB secret literals before sending, the ping does not follow a redirect, and the URL must be https. [Source: ADR-0033](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L146-L154)
- **A sensor that is off sends nothing.** A missing ping covers the success sensor's silence, but nothing covers the failure sensor's. Both are declared as running from the start, and a test asserts it. [Source: ADR-0033](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L137-L140)
- **A `/fail` that cannot be sent is not retried.** After three attempts the sensor tick fails and Dagster moves past that run. For a failed `lake_maintenance` run, the failed tick is the only trace. [Source: ADR-0033](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L100-L105)
- **One failing job marks the whole check down.** A failure in any job, compaction included, keeps the environment's check down until the next successful USGS run. That is deliberate: the check means "this environment's pipeline is healthy". [Source: ADR-0033](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L128-L130)
- **The code refuses to load without the URL.** The sensors read `HEARTBEAT_URL` when the code location loads, so a missing or non-https value stops it loudly and never prints the value. [Source: ADR-0033](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L98-L99) · [Source: alarm.py](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/platform/orchestration/lagom_orchestration/alarm.py#L56-L74)
- **The main risk is an alert nobody reads.** The e-mail goes to the operator's account, and whether it reaches a phone is the operator's own setting. [Source: ADR-0018](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L121-L123)
