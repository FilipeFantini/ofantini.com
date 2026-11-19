---
title: "Nobody touches the cluster by hand: Git is the only way in"
summary: "How one repository became the source of truth for a single Kubernetes node: Argo CD managing itself, an app of apps, and images promoted by digest from staging to prod."
project: lagom
group: infrastructure
order: 2
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0009", "0015", "0017", "0021"]
---

If anyone can change a server by hand, nobody can say what it runs. Keeping infrastructure in version control is standard practice. What I wanted on top of it is a cluster that corrects anything that drifts from the commits, so every change is a reviewed commit.

## How it works

The loop has one moving part, Argo CD, a program inside the cluster that does the reconciling. Think of a thermostat. The repository's `main` branch says what the temperature should be, and Argo CD keeps measuring the room and adjusting until the two match. A manual change is undone on the next pass (the setting is called `selfHeal`). An object removed from Git is deleted from the cluster (`prune`).

[Source: architecture](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L105-L109)

![Flow from a merged pull request to the cluster: main is polled by Argo CD, which applies the difference; a change made by hand is reverted by selfHeal](/diagrams/infrastructure-gitops.svg)

Argo CD polls Git every 120 seconds plus up to 60 seconds of jitter, so a merge lands within about three minutes.

[Source: deploy docs](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1086-L1093)

It learns what to run through an app of apps. One `root` Application, the object that tells Argo CD "watch this path and apply it", watches `platform/infra/apps/` and creates every Application it finds there, including the one for Argo CD itself. Adding a component means adding one file.

[Source: the Argo CD decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0009-argocd-bootstrap-and-self-management.md#L46-L57)

Code reaches the cluster as an image named by its digest, a fingerprint of the exact bytes. Staging and prod each pin their own digest, so promotion is a commit, and a CI check refuses a prod digest that staging had not pinned first.

[Source: the registry decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L54-L72) · [Source: the registry decision, note of 2026-10-19](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L126-L131)

## The trade-off

Argo CD manages itself, and self-management can lock itself out: a bad change to Argo CD's own values can break Argo CD, which then can't apply the fix. So pruning is off on the `argocd` Application, and the runbook keeps a `helm upgrade` command as the break-glass path.

[Source: the Argo CD decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0009-argocd-bootstrap-and-self-management.md#L83-L90)

Git is also the only way in only inside the cluster. The server, its firewall, the access rules, the login application and its DNS records, and the heartbeat checks are created by hand from the runbook.

[Source: infrastructure](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L74-L80)

The first test of the loop, on 2026-10-13, applied a merged change 66 seconds after the merge, and a `kubectl scale` run by hand was reverted after 2 seconds.

[Source: deploy docs](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1095-L1100)

## Details

How Argo CD was installed, the image flow and the registry alternatives, the race between Applications on an empty cluster, the repository credential that was removed, and the k3s components moved under Git:

[Source: the Argo CD decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0009-argocd-bootstrap-and-self-management.md#L29-L37) · [Source: the registry decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L35-L50) · [Source: its consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L99-L107) · [Source: handing over to Argo CD](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1058-L1068) · [Source: the public repository decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L1-L5) · [Source: the k3s components decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0021-k3s-packaged-components-under-git.md#L30-L36)
