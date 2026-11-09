---
title: "The boring checklist I wish I'd had: a public repo with no secrets in it"
summary: "A starter checklist for anyone who never worked as a software engineer: what to do before the first commit, before going public and on every pull request, and how each item was done cheaply on one machine."
project: lagom
track: security
order: 1
lagom_commit: c98710575c9fb5bc76463aa01750df27e9158019
adrs: ["0010", "0017"]
---

Everything the cluster runs comes from Git, and the repository is public, so anyone can read it. Keeping secrets out of a public repository is something every engineer already knows. I come from data, not from software engineering, and nobody handed me the short list of what to do about it. This is that list, as it would have helped on day one, followed by how each item was done cheaply on one machine and what went wrong.

## What was built

Here is the checklist. A repository is the folder where Git keeps every version of every file, so what you commit once stays findable. Database passwords and tokens still have to be configured somewhere, which is why the first group has more than "don't".

**Before the first commit**
- Write down what never goes in: passwords, tokens, keys, and anything that identifies you or addresses your infrastructure. A rule on paper is what you check against later.
- Decide how secrets will still reach the system. If the answer is "I'll paste them in by hand", the repository stops being the single source of what runs.
- Back up the key that decrypts them, and practise restoring it. A secret you cannot decrypt is as lost as one that leaked.

**Before going public**
- Scan everything, not only the files you see: every commit on every branch, pull-request text, logs. A secret committed and then deleted is still in the history.
- If you find things you would rather not expose, publish a fresh copy instead of flipping the repository to public. Publication cannot be undone.

**Every pull request**
- Scan the whole history automatically, and keep the scan's exceptions as narrow as you can.
- Put changes to the scan itself behind a person's approval.

None of this is clever. The interesting part is how each item was done, and the gotchas, so here are the four pieces behind that list.

**Sealed secrets** (the second and third items before the first commit). Sealed Secrets is a small controller in the cluster. It generates a key pair. Anyone with the `kubeseal` tool can encrypt a Secret with the public key, and the result, a `SealedSecret`, is safe to commit. Only the controller holds the private key, and it turns each `SealedSecret` into an ordinary Secret inside the cluster. A sealed secret is bound to its name and namespace by default, so copying it into another namespace makes it unreadable there.

[Source: the sealed secrets decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0010-sealed-secrets.md#L42-L47)

![Flow of a secret: kubeseal encrypts it with the public key, the sealed file is committed, Argo CD applies it, the controller decrypts it with the private key into an ordinary Secret; the private key is backed up off the cluster and restored first on a rebuild](/diagrams/security-public-repo.svg)

Key renewal is off. By default the controller adds a new key every 30 days, and each new key must be backed up off the cluster. A missed backup makes every secret sealed with that key unrecoverable after a rebuild. So the private key is backed up once, to a password manager, and restored before anything else on a rebuild.

[Source: the sealed secrets decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0010-sealed-secrets.md#L49-L56)

**A snapshot** (before going public). The repository began private. Before publishing, a review scanned the working tree, every commit on every branch, GitHub's pull-request refs, pull-request text and the Actions logs. It found no secret. It did find identifiers of me and of the network that a public repository would expose for good. So publication came from a snapshot: the private repository was renamed, kept private and archived, and a new public repository took the original name with a history that starts at one commit.

[Source: the public repository decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L9-L20) · [Source: its decision section](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L59-L65)

![Flow of publication: the private repository is archived, and its main becomes a single-commit snapshot that starts the new public repository, which is scanned for secrets on every pull request](/diagrams/security-public-repo-2.svg)

**A scan of the whole history** (every pull request). CI runs gitleaks, a secret scanner, over the whole history on every pull request and every push to `main`. The history, not only the latest commit, because a secret committed and then deleted is still in the history, and so still leaked. The scanner binary is pinned by version and checked against its SHA-256, and `--redact` keeps a finding out of the job log, which anyone with read access can open.

[Source: the CI workflow](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L5-L8) · [Source: the secret scan job](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/workflows/ci.yml#L66-L91)

**A rule** (the first item before the first commit). `AGENTS.md`, the rulebook for the agents and humans working in the repository, says to keep anything that identifies me or addresses the infrastructure out of it, and to use placeholders instead. It names e-mail, user names, keys, tailnet names and IP addresses. The GitHub account name, the license holder and the domain are the accepted exceptions, and commits use the GitHub noreply address.

[Source: the rulebook](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/AGENTS.md#L1-L8) · [Source: the rulebook, non-negotiables](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/AGENTS.md#L54-L61)

## Why this way

For secrets, two other routes were compared. SOPS with age encrypts values inside ordinary YAML, but Argo CD (the program in the cluster that keeps it matching the repository) cannot read those files natively. It needs a plugin in its repo-server and the private key mounted into it, more moving parts in the component everything else depends on. An external store such as Vault or the 1Password Operator keeps secrets out of Git entirely, but Vault alone exceeds the sealed-secrets controller's memory by an order of magnitude, and the 1Password Operator ties the cluster to a paid service.

[Source: the sealed secrets decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0010-sealed-secrets.md#L24-L34)

For publication, three alternatives lost. Flipping the repository to public is one click, and it turns every identifier into permanent history. Rewriting history with `git filter-repo` depends on GitHub Support to purge pull-request refs, leaves pull-request pages pointing at vanished commits, and breaks image tags, which are commit SHAs: the same losses as a fresh start with more steps. A pseudonymous account would also hide my name, but I rejected it, since the GitHub account is the project's public identity.

[Source: the public repository decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L41-L55)

The costs are written down. Public history starts at the snapshot, so earlier commits and reviews exist only in the private archive. Images built before publication carry tags naming commits that exist only there. The cluster's sealing key is a single point of loss, and without automatic renewal the same key protects every secret until it is rotated by hand, so a leaked key exposes everything sealed so far.

[Source: its consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L128-L135) · [Source: the sealed secrets decision, consequences](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0010-sealed-secrets.md#L69-L73)

## How it's going

The restore procedure, which puts the sealing key back before the root Application is applied, was exercised on 2026-10-28. The result was one key Secret, five `SealedSecret`s reporting `SYNCED True`, and the same certificate fingerprint on both nodes.

[Source: sealed secrets](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1141-L1144) · [Source: sealed secrets](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/architecture.md#L1172-L1173)

The cutover to the public repository ran on 2026-10-27. My plan predicted a short comparison error in Argo CD, and I corrected the notes afterwards: it never paused.

[Source: the public repository decision, notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L168-L183)

## Gotchas

**The review found no secret, and still found plenty to hide.** The e-mail address, the network's DNS name and address, the node's public address in the text of two pull requests, an SSH public key. None grants access on its own, and the notes say the controls do not depend on them being secret. I chose to expose as little as possible anyway. That is the rule's origin.

[Source: the public repository decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L13-L23)

**The cutover prediction was wrong, for a reason inferred and not documented.** The old SSH address kept working against the new public repository. My notes say this is inferred from behaviour, not from GitHub's documentation: GitHub lets an SSH key it authenticates, even a deploy key registered on another repository, read a public repository.

[Source: the public repository decision, notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L168-L177)

**A planned step was dropped on purpose.** The plan replaced the node's public address. It was skipped: the old address appears only in the private archive's pull-request text, the node accepts no inbound connection on it, and the swap would power the node off. The trigger to revisit is written down: if the archive's text is ever exposed, or if the firewall gains an inbound rule.

[Source: the public repository decision, notes](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L184-L194)

**The scan has one exception, kept narrow.** Sealed ciphertext is high-entropy, so the generic rule flags it. The config allows only that rule, and matches on the line, not the path. A path entry makes gitleaks skip the whole file, so a plaintext password in a file named like a sealed one would pass unseen. A specific rule, such as a GitHub token, still reports on the same line. The config is also on the list of paths whose change waits for my approval, so a change to the scan does too.

[Source: the scan config](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.gitleaks.toml#L6-L21) · [Source: the list of guarded paths](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/CODEOWNERS#L7-L9) · [Source: the list](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/.github/CODEOWNERS#L17-L21)

**Publication cannot be undone.** The repository can be made private again, but what was public may already be cloned or indexed.

[Source: the public repository decision](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/adr/0017-public-repository-from-a-snapshot.md#L158-L161)

## What's next

Secret rotation has no runbook yet. The roadmap leaves it open until a credential is first rotated, because the node move rotated nothing.

[Source: roadmap](https://github.com/FilipeFantini/lagom/blob/c98710575c9fb5bc76463aa01750df27e9158019/docs/roadmap.md#L232-L233)
