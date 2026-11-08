---
title: "Fitting a data platform in 4 GB, then moving to 8 GB"
summary: "How we measured memory on a small node, turned the measurements into a limit that CI enforces, and moved to a bigger node when the plan stopped fitting."
project: lagom
track: infrastructure
order: 1
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0002", "0011", "0016", "0020", "0021", "0024"]
---

A data platform spends most of its life waiting. The services that wait for the next job sit in memory all day, and on a small server that waiting costs more than the work. We started on a 4 GB machine and had to learn, before building more, whether the planned stack would fit with room left for jobs.

## What we built

The platform runs on one server, under k3s, a small Kubernetes. Every program in it runs in a pod. Each container in a pod declares a memory request (what the scheduler reserves for it) and a memory limit (the most it may use). Think of a restaurant with a fixed number of seats: requests are the reservations, and the room only works if the reservations add up to fewer than the seats.

A CI check does that addition on every pull request. `tools/resource_budget.py` renders every Application the way Argo CD does (Argo CD is the tool that applies the repository to the cluster). It fails the build if a container lacks a memory request, a memory limit or a CPU request, or if the total passes a ceiling written in `docs/architecture.md`. The total is the resident requests, plus every ephemeral job at once, plus an allowance for what k3s installs outside Git.

[Source: architecture.md, section 11](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L575-L594)

The ceiling is not a guess. Some memory is used outside Kubernetes (k3s itself, the container runtime, the operating system), and nothing counts it. We measure it as resident set size, the memory a process holds, which overstates slightly because shared pages are counted once per process. The ceiling is the memory the OS sees, minus that overhead, minus a margin.

[Source: architecture.md, section 11](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L548-L565)

One lever matters more than the rest. Every resident Go program runs with `GOMEMLIMIT`, an environment variable that tells Go's runtime how much memory to aim for. Without it, Go lets the heap grow to about twice its live size and keeps idle memory from the OS.

[Source: ADR-0011](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0011-memory-viability-on-4gb.md#L89-L91) and [architecture.md](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L548-L550)

## Why this choice

The first node was a Hetzner CAX11: 2 ARM vCPUs and 4 GB. The ADR rejected a 1 GB Raspberry Pi, where k3s alone would take a third of the memory, and full kubeadm Kubernetes, which it estimated at about 1.2 GB for the control plane against 300 MB for k3s.

[Source: ADR-0002](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0002-single-node-k3s-hetzner.md#L26-L37) · [Source: ADR-0002](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0002-single-node-k3s-hetzner.md#L51-L52)

Then we measured the planned stack on the node. The projection came to about 2.75 GB of 3.8 GB, with about 1 GB left for jobs. The decision was to keep the stack and to name, in advance, what would trigger a move to an 8 GB node: available memory under about 500 MiB in normal operation, a component that cannot fit under the ceiling after tuning, or a fit that would mean removing staging, backups or monitoring.

[Source: ADR-0011](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0011-memory-viability-on-4gb.md#L67-L100)

When the overhead turned out larger, the ceiling came down to match. ADR-0016 rejected three alternatives: keep 2.6 GB and trust the node, lower to the full measured room of 2.3 GB with no margin, or move to 8 GB at once. The operator's rule was to move when a component does not fit, not in anticipation. Dagster, the orchestrator, did not fit. The ADR for the move says it departs from "observed" because the projected gap, about 380 MiB, was too large to tune away. The price was roughly double the monthly cost, and Milestone 3 (M3, the Dagster step) was blocked on a vendor's capacity, not on work.

[Source: ADR-0016](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0016-ci-ceiling-2-2-gb.md#L30-L62) · [Source: ADR-0020](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0020-move-to-the-8-gb-node.md#L8-L62)

## How it has worked

On the new 8 GB node, measured on 2026-10-28 with k3s up for about two hours and 12 pods running, the OS saw 7,741 MiB and 1,687 MiB sat outside Kubernetes. That left about 6,050 MiB for pods. The ceiling was set at 5.5 GB (5,632 MiB), about 420 MiB under that, for k3s's growth over days and for the container-runtime shims of new pods, which requests do not count.

[Source: ADR-0024](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0024-ci-ceiling-on-the-8-gb-node.md#L19-L64)

The chart shows the declared requests against the ceiling at five points. The "M3 plan" bar is a projection, about 2,630 MiB with Dagster at the 600 MiB its spike measured. The line steps up when the node changes.

![Bar chart of declared memory requests against the CI ceiling: the M3 plan on the 4 GB node passes a 2,253 MiB ceiling, while 5,070 MiB on the 8 GB node sits under 5,632 MiB](/diagrams/infrastructure-memory-budget.svg)

[Source: ADR-0016](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0016-ci-ceiling-2-2-gb.md#L53-L62) · [Source: ADR-0016, note of 2026-10-19](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0016-ci-ceiling-2-2-gb.md#L84-L90) · [Source: ADR-0024](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0024-ci-ceiling-on-the-8-gb-node.md#L69-L72)

[Source: architecture.md, section 11](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L568-L573) and [the ceiling of the time](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L630-L632)

At the pinned commit the total was 5,070 MiB: Dagster in two environments and the tunnel that serves the operator's tools. It had been 5,582, 50 MiB under the ceiling, until two CronJobs were retired on 2026-11-07 and freed 256 MiB each.

[Source: architecture.md, section 11](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L559-L573)

## Gotchas

**The k3s estimate was far too low.** The ADR quoted about 300 MB for k3s. On the node it held 627 MB, plus about 265 MB for the container runtime. After 17 hours with no memory limit it reached 1,235 MB of RSS while the Go runtime reported only 421 MiB of live heap.

[Source: ADR-0002](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0002-single-node-k3s-hetzner.md#L120-L126) · [Source: ADR-0011](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0011-memory-viability-on-4gb.md#L41-L47)

**The fix caused its own problem.** `GOMEMLIMIT=600MiB` held k3s at about 720 to 735 MiB over the first half hour. After a second Postgres cluster and a network policy arrived, k3s held 719 to 753 MiB against that limit, ran about five garbage collections per second and used about 1.9 of the node's 2 vCPUs, while all the pods together used 27m. The ADR had named this trade-off, CPU for memory, and it still happened. Raising the limit to 900MiB brought CPU to 144m. It was found by chance in a post-deploy check, which the ADR records as an escape under its guardrails.

[Source: ADR-0011](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0011-memory-viability-on-4gb.md#L116-L118) and [the note of 2026-10-17](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0011-memory-viability-on-4gb.md#L135-L147)

**The gate allowed more than the node could hold.** The 2.6 GB ceiling came from an overhead of about 1.1 GB. By 2026-10-17 it measured about 1.5 GB, so 3.8 minus 1.5 left about 2.3 GB while the check still allowed 2.6. ADR-0016 calls that false confidence.

[Source: ADR-0016](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0016-ci-ceiling-2-2-gb.md#L10-L20)

**The check under-counted.** It took only the largest ephemeral job, but staging and prod pipelines shared a schedule and ran together. Counting every job at once added 256 MiB at that peak. The allowance for k3s's own components was 170 MiB, built from early measurements of Traefik (about 20 MiB) and local-path (about 10 MiB), which by then used 120 and 47 MiB. Traefik served nothing. ADR-0021 disabled it and put local-path and metrics-server under Git.

[Source: ADR-0016](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0016-ci-ceiling-2-2-gb.md#L84-L90) · [Source: ADR-0021](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0021-k3s-packaged-components-under-git.md#L19-L37)

**A generous ceiling checks little.** ADR-0024 says a ceiling this far above use catches only large mistakes and leaves many small additions to review. It also asks for a re-measure after at least three days of uptime. The roadmap item reads "re-measured after three days of uptime", while the architecture document still says the overhead is "to be measured again". Neither records a figure, so we cannot tell you what it showed.

[Source: ADR-0024](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0024-ci-ceiling-on-the-8-gb-node.md#L79-L88)

[Source: architecture.md, section 11](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L533-L534) and [the roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L234-L237)

## What comes next

The larger node is room for the planned design, not licence to add to it. The full design adds NATS with Redpanda Connect, Streamlit, Grafana and PgBouncer, which enter by trigger and bring the total to about 4.0 GB of requests, leaving about 1.5 GB within the ceiling.

[Source: architecture.md, section 11](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L643-L657)
