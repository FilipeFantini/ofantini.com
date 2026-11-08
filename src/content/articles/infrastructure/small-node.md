---
title: When the small node stopped fitting
summary: "A small server can run a serious data platform if it leaves room for the jobs as well as the services that wait for them."
project: lagom
track: infrastructure
order: 1
lagom_commit: 3d6039735d0ffca19553c1669d506f34da241a68
adrs: ["0011", "0020"]
---

A small server can run a serious data platform, but only if there is room for the jobs as well as the services that wait for them.

## The first measurement

The original plan kept the orchestration and deployment tools together on a small node. The team measured how much memory they used rather than relying on estimates. That gave the platform a starting budget, with a condition for moving to a larger machine if the planned work could no longer fit.

## The decision changed

Later, the projected requests for the next stage exceeded the budget. The team chose a larger node before adding the orchestration service. The trade-off was a higher monthly cost in exchange for keeping room for the planned stack and its jobs.

![Flowchart showing the measured memory budget and move to a larger node](/diagrams/infrastructure.svg)

## What this taught me

A resource limit is useful when it prompts a decision, not when it forces the system to lose capabilities it needs. The measurements and their assumptions remain part of the record.

Sources: [ADR-0011](https://github.com/FilipeFantini/lagom/blob/3d6039735d0ffca19553c1669d506f34da241a68/docs/adr/0011-memory-viability-on-4gb.md) and [ADR-0020](https://github.com/FilipeFantini/lagom/blob/3d6039735d0ffca19553c1669d506f34da241a68/docs/adr/0020-move-to-the-8-gb-node.md).
