---
title: "A security checklist for a public repository"
summary: "A starter checklist for people new to software engineering: what to do before the first commit, before going public and on every pull request, and how each item was done cheaply on one machine."
project: lagom
group: security
order: 1
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0010", "0017"]
---

Everything the cluster runs comes from Git, and the repository is public. Below is the short list of what that requires, for readers from data rather than software engineering, then how each item was done cheaply on one machine.

## The checklist

A repository is where Git keeps every version of every file, so what is committed once stays findable.

**Before the first commit**
- Write down what never goes in: passwords, tokens, keys, and anything that identifies you or addresses your infrastructure.
- Decide how secrets will reach the system. If they are pasted in by hand, the repository stops being the single source of what runs.
- Back up the key that decrypts them, and practise restoring it. A secret you cannot decrypt is as lost as one that leaked.

**Before going public**
- Scan everything, not only the visible files: every commit on every branch, pull-request text, logs. A secret committed and then deleted is still in the history.
- If something should not be exposed, publish a fresh copy instead of flipping the repository to public. Publication cannot be undone.

**Every pull request**
- Scan the whole history automatically, and keep the scan's exceptions as narrow as you can.
- Put changes to the scan itself behind a person's approval.

## How it works

**Sealed secrets.** Sealed Secrets is a controller in the cluster with a key pair. Anyone with `kubeseal` can encrypt a Secret with the public key into a `SealedSecret`, which is safe to commit; only the controller holds the private key and turns it back into an ordinary Secret in the cluster. Key renewal is off, so the private key is backed up once, to a password manager, and restored first on a rebuild.

[Source: the sealed secrets decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0010-sealed-secrets.md#L42-L47) · [Source: the sealed secrets decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0010-sealed-secrets.md#L49-L56)

![Flow of a secret: kubeseal encrypts it with the public key, the sealed file is committed, Argo CD applies it, the controller decrypts it with the private key into an ordinary Secret; the private key is backed up off the cluster and restored first on a rebuild](/diagrams/security-public-repo.svg)

**A snapshot.** Before publishing, a review scanned the history, pull-request text and the Actions logs. It found no secret but did find identifiers of the operator and of the network, so a new public repository took the name with a history that starts at one commit, and the private one was archived.

[Source: the public repository decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L9-L20) · [Source: its decision section](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L59-L65)

**A scan and a rule.** CI runs gitleaks, a secret scanner, over the whole history on every pull request and push to `main`, and `AGENTS.md` keeps anything that identifies the operator or addresses the infrastructure out of the repository.

[Source: the secret scan job](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L66-L91) · [Source: the rulebook, non-negotiables](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/AGENTS.md#L54-L61)

## The trade-off

Public history starts at the snapshot, so earlier commits and reviews exist only in the private archive. Without automatic key renewal, a leaked sealing key exposes everything sealed so far.

[Source: its consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L128-L135) · [Source: the sealed secrets decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0010-sealed-secrets.md#L69-L73)

## Details

Alternatives, the restore drill, the cutover, the review's findings, the scan's one exception and rotation:

[Source: the sealed secrets decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0010-sealed-secrets.md#L24-L34) · [Source: the public repository decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L41-L55) · [Source: sealed secrets](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1141-L1144) · [Source: the public repository decision, notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L168-L183) · [Source: the public repository decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L13-L23) · [Source: the scan config](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.gitleaks.toml#L6-L21) · [Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L232-L233)
