---
title: "Nobody touches the cluster by hand: Git is the only way in"
summary: "How I made one repository the source of truth for a single Kubernetes node: Argo CD managing itself, an app of apps, and images promoted by digest from staging to prod."
project: lagom
track: infrastructure
order: 2
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0009", "0015", "0017", "0021"]
---

If anyone can change a server by hand, nobody can say what it runs. Keeping infrastructure in version control is standard practice. What I wanted on top of it is a cluster that corrects anything that drifts from the commits, so every change is a reviewed commit. This is how that works, where it stops, and how a new version of my code gets from a pull request into production.

## What I built

The loop has one moving part, Argo CD, a program inside the cluster that does the reconciling. Think of a thermostat. The repository's `main` branch says what the temperature should be, and Argo CD keeps measuring the room and adjusting until the two match. Every few minutes it compares what `main` says should exist with what runs. A manual change is undone on the next pass (the setting is called `selfHeal`). An object removed from Git is deleted from the cluster (`prune`).

[Source: architecture](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L105-L109)

Argo CD learns what to run through an app of apps. One `root` Application, the object that tells Argo CD "watch this path and apply it", watches `platform/infra/apps/` and creates every Application it finds there, including itself. Adding a component means adding one file. Argo CD also manages itself: an `argocd` Application combines a pinned upstream Helm chart (Helm is a package manager for Kubernetes) with a values file in the repository, so changing Argo CD is a commit like any other.

[Source: the Argo CD decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0009-argocd-bootstrap-and-self-management.md#L46-L57)

![Flow from a merged pull request to the cluster: main is polled by Argo CD, which applies the difference; a change made by hand is reverted by selfHeal](/diagrams/infrastructure-gitops.svg)

Argo CD polls Git every 120 seconds plus up to 60 seconds of jitter, so a merge lands within about three minutes. It watches the cluster continuously.

[Source: deploy docs](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1086-L1093)

Code reaches the cluster as an image, a container packed with the code and its locked dependencies. CI builds it on a push to `main`. Manifests name it as `name:tag@sha256:...`: the tag is for readers, and the digest, a fingerprint of the exact bytes, is what gets pulled. Staging and prod each pin their own digest, so promotion is a commit.

[Source: the registry decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L54-L72)

![Flow of an image: the code merges, CI builds it, staging pins the digest, prod pins the same digest, and a promotion check refuses a digest staging had not pinned first](/diagrams/infrastructure-gitops-2.svg)

## Why this way

To install Argo CD I compared raw upstream manifests with Kustomize patches against a Helm chart with a values file. I rejected the patches: the upstream file declares no resources, so each of six components needs a patch, and the patches break silently when upstream renames a container. I also rejected the headless `core-install`, because I'm learning the reconciliation loop and the UI is where its state is visible. That UI server costs about 50 MB.

[Source: the Argo CD decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0009-argocd-bootstrap-and-self-management.md#L29-L37)

For images, three alternatives lost. Running the code from the official `uv` image on every run needs no registry, but what runs is assembled at run time instead of built and tested once. I kept it as the exit plan if GHCR (GitHub's container registry) stops being free. A registry inside the cluster with in-cluster builds adds two components and build spikes on a node with about 1 GB of margin. A public package would expose the code while the repository was private.

[Source: the registry decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L35-L50)

The digest model also answers a question: how does staging go first while Argo CD watches only `main`? The environments differ in which digest they pin, not in which branch they follow. The cost I accepted is that a code change takes three pull requests, two of them digest bumps. I put off automating the staging bump until the manual bumps become routine.

[Source: the registry decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L63-L72) · [Source: its consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L99-L107)

## How it's going

The first test of the loop was measured on 2026-10-13. A one-line change to a small nginx page was merged at 13:34:59 and applied by Argo CD at 13:36:05, 66 seconds later, and served about 20 seconds after that. A `kubectl scale` I ran by hand was reverted by Argo CD after 2 seconds.

[Source: deploy docs](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1095-L1100)

On 2026-10-28, on an empty cluster, all nine Applications were `Synced` and `Healthy` 65 seconds after `root` was applied.

[Source: handing over to Argo CD](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1063-L1066)

## Gotchas

**Self-management can lock itself out.** A bad change to Argo CD's own values can break Argo CD, which then can't apply the fix. So pruning is off on the `argocd` Application, and the runbook keeps a `helm upgrade` command as the break-glass path. After the handover, Helm's own record of the release also goes stale, and `helm list` shows the bootstrap revision forever.

[Source: the Argo CD decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0009-argocd-bootstrap-and-self-management.md#L83-L90)

**The first design had a repository credential, and a later decision removed it.** I gave Argo CD a read-only SSH deploy key, reasoning that the credential Argo CD needs to read the repository can't itself come from the repository. Then the repository went public, and that decision was superseded. Argo CD now clones it anonymously over HTTPS, so there is no key to create, rotate or lose on a rebuild. The trade-off is GitHub's limits for anonymous reads, which a poll every few minutes stays far below.

[Source: the Argo CD decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0009-argocd-bootstrap-and-self-management.md#L58-L62) · [Source: the public repository decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L1-L5) · [Source: installing Argo CD](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1031-L1037)

**On an empty cluster the Applications race.** `root` creates them all at once with no sync order, so `postgres-prod` tried to create a database `Cluster` before the operator that defines that type had installed. It failed twice and succeeded on the third try, 32 seconds after `root` was applied. Argo CD's default retry covered it, and the retry is not set in my manifests. A sync that still fails after five tries stays failed until the next commit.

[Source: handing over to Argo CD](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1058-L1068)

**The promotion order began as a convention.** When I chose digests, "prod only receives digests staging pinned" was just a convention until a check asserted it. Three days after the decision, `tools/promotion_check.py` made it a CI check: it fails a change whose prod manifests pin an image by tag only, or by a digest staging had not pinned in any earlier commit. It asserts "pinned on `main` first", not "ran successfully", because CI never reaches the cluster. I confirm the run before opening the prod pull request.

[Source: the registry decision, note of 2026-10-19](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0015-images-on-ghcr.md#L126-L131) · [Source: environments](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L342-L350)

**Some of the platform was not under Git at first.** k3s, the small Kubernetes I run, installs components of its own, and Traefik, which served nothing, still used 120 MiB. I disabled it and moved local-path and metrics-server under Argo CD, leaving CoreDNS as the one workload outside Git. The switch itself had a step my plan missed: the Traefik uninstall hung on a finalizer that only the disabled load balancer could remove, until I cleared it by hand.

[Source: why k3s components moved under Git](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0021-k3s-packaged-components-under-git.md#L19-L21) · [Source: the decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0021-k3s-packaged-components-under-git.md#L30-L36) · [Source: the consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0021-k3s-packaged-components-under-git.md#L66-L69) · [Source: note of 2026-10-27](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0021-k3s-packaged-components-under-git.md#L99-L107)

**Git is the only way in only inside the cluster.** The server, its firewall, the access rules, the login application and its DNS records, and the heartbeat checks are created by hand from the runbook. Argo CD reconciles only what runs inside the cluster.

[Source: infrastructure](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L74-L80)

## What's next

Terraform is to take over those hand-made resources, by a trigger in the roadmap's trigger table.

[Source: infrastructure](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L79-L80)
