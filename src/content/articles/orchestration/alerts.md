---
title: "Alerting on pipeline failures and missed runs"
summary: "How a missing ping turns a silent pipeline into an e-mail, and how Dagster's failure sensor and heartbeat replaced the scheduled jobs that first did the job."
project: lagom
group: orchestration
order: 2
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0018", "0033"]
---

On 2026-10-27 the earthquake pipeline failed in staging and production for about 90 minutes: three events arrived with their status in capitals, and a test stopped every run. No alert was sent, and the failure was found only by chance. Failing loudly helps only if the noise reaches a person, and a pipeline that never starts says nothing at all.

[Source: the heartbeat decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L9-L21)

## How it works

The server accepts no inbound connection, so an outside monitor has nothing to probe. The pipeline reports in instead, and silence is the alarm.

[Source: the heartbeat decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L23-L25)

Healthchecks.io expects a ping on a schedule, one check per environment, and e-mails the operator when none arrives within the schedule plus a grace period: every 30 minutes with 20 minutes of grace, so about 50 minutes at worst. The ping is an outbound HTTPS request, so no port opens.

[Source: the heartbeat decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L63-L70) · [Source: the heartbeat decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L98-L99)

Dagster, the scheduler, does the reporting through two **sensors**, its watchers on run events. One pings after each successful `usgs` run. The other calls the check's `/fail` endpoint for any failed run, with the job name, run ID and error, and the e-mail goes out at once. They replaced the scheduled Kubernetes jobs that first ran the pipeline and pinged.

![Sequence diagram: Dagster pings Healthchecks.io after each successful run; when the node stops and no ping arrives within the schedule plus the grace period, an e-mail is sent; when a run fails, Dagster calls /fail and an e-mail follows at once; the next successful run brings the check up again.](/diagrams/orchestration-alerts.svg)

[Source: the alerts decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L73-L87) · [Source: the alerts decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L106-L111)

## The trade-off

The two failures differ. A failed run can be reported at once, with its error; a node or cluster that is down can report nothing. The failure sensor covers the first, the missing ping the second.

[Source: the alerts decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L31-L39)

The accepted cost is a third party in the alert path: if Healthchecks.io is down, alerts stop silently. Its code is open source, so self-hosting it off the node is the exit.

[Source: the heartbeat decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L101-L108)

Staging passed a ping and a deliberate `/fail` on 2026-11-07, and production switched the same day.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L266-L275)

## Details

The alternatives, the first heartbeat on scheduled jobs, the cutover, who can silence the alarm, keeping passwords out of an error, and the grace period's estimate:

[Source: the heartbeat decision, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L37-L59) · [Source: the heartbeat decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0018-pipeline-heartbeat.md#L72-L76) · [Source: the alerts decision, alternatives](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L50-L69) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1377-L1384) · [Source: the alerts decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L88-L99) · [Source: the alerts decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0033-dagster-alerts-through-healthchecks.md#L146-L154) · [Source: runbook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1325-L1331)
