---
title: "Measuring and capping memory on a small node"
summary: "How memory was measured on a small node, turned into a limit that CI enforces, and how the platform moved to an 8 GB node when the plan no longer fit."
project: lagom
group: infrastructure
order: 1
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0002", "0011", "0016", "0020", "0021", "0024"]
---

On a small server, the services that wait all day for the next job cost more memory than the work. The platform started on a 4 GB machine, so before more was built, the question was whether the planned stack would fit with room left for jobs.

## How it works

The platform runs on one server under k3s, a small Kubernetes. Each container declares a memory request (what the scheduler reserves) and a limit (the most it may use). Like restaurant reservations, requests must add up to fewer than the seats.

A CI check does that sum on every pull request: `tools/resource_budget.py` renders every Application as Argo CD would and fails the build if a container lacks a memory request, a memory limit or a CPU request, or if the total passes a ceiling written in `docs/architecture.md`.

[Source: memory budget](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L575-L594)

The ceiling is the memory the OS sees, minus what runs outside Kubernetes (k3s itself, the container runtime, the operating system), minus a margin.

[Source: memory budget](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L548-L565)

![Bar chart of declared memory requests against the CI ceiling: the next plan on the 4 GB node exceeds a 2,253 MiB ceiling, while 5,070 MiB on the 8 GB node sits under 5,632 MiB](/diagrams/infrastructure-memory-budget.svg)

The first bar uses the old count, which took only the largest ephemeral job; the later bars add every ephemeral job at once.

[Source: the ceiling decision, its note of 2026-10-19](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0016-ci-ceiling-2-2-gb.md#L84-L90) · [Source: memory budget](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L568-L573)

## The trade-off

The planned stack was kept on 4 GB, with the triggers for a move to 8 GB named in advance, such as available memory under about 500 MiB in normal operation.

[Source: the memory decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0011-memory-viability-on-4gb.md#L67-L100)

When the overhead outside Kubernetes turned out larger, the ceiling was lowered and Dagster, the orchestrator, was projected not to fit. The rule was to move when a component does not fit, not in anticipation; the price was roughly double the monthly cost.

[Source: the ceiling decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0016-ci-ceiling-2-2-gb.md#L30-L62) · [Source: the move to 8 GB](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0020-move-to-the-8-gb-node.md#L8-L62)

On the 8 GB node the ceiling is 5.5 GB (5,632 MiB), about 420 MiB under the measured room for pods.

[Source: the 8 GB ceiling decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0024-ci-ceiling-on-the-8-gb-node.md#L19-L64)

The weak point was the first estimates: about 300 MB for k3s, which held 627 MB on the node, and about 1.1 GB outside Kubernetes, which grew to about 1.5 GB. For a while the check allowed more than the node could hold.

[Source: the single-node decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0002-single-node-k3s-hetzner.md#L120-L126) · [Source: the ceiling decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0016-ci-ceiling-2-2-gb.md#L10-L20)

## Details

The measurements over time, the `GOMEMLIMIT` tuning that traded CPU for memory, the components moved under Git and the alternatives weighed:

[Source: the single-node decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0002-single-node-k3s-hetzner.md#L26-L37) · [Source: the memory decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0011-memory-viability-on-4gb.md#L41-L47) · [Source: its note of 2026-10-17](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0011-memory-viability-on-4gb.md#L135-L147) · [Source: the 8 GB ceiling decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0024-ci-ceiling-on-the-8-gb-node.md#L79-L88) · [Source: the k3s components decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0021-k3s-packaged-components-under-git.md#L19-L37) · [Source: memory budget](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L559-L573)
