# ADR-0005 — A second kind of project: a practice applied across repositories

- **Status:** Accepted, by the operator approving the pull request that adds it
- **Date:** 2026-11-21
- **Decided by:** the operator, on 2026-11-21: the way AI agents develop
  Lagom and this site is a project of its own, Agentic Development Patterns,
  applied in several repositories and meant to be reused in others. Its page
  says where it is applied, and its introduction may laugh a little at the
  word "agentic".
- **Builds on:** [ADR-0004](0004-projects-as-packages.md), which made each
  project one card on the Projects page.

## Context and problem

Every project, article and route assumed Lagom. A project needed a platform
with groups and data subprojects, every article belonged to one of them and
was pinned to a Lagom commit, and the pages lived under `/projects/lagom/`.
The development model, with its rulebook, roles and gates, runs in Lagom and
in this site's repository alike, so an article about it belongs to neither
project's sections, and its sources sit in two repositories.

## Requirements and constraints

- The model reads as a project in its own right, with the repositories it is
  applied in, not as a part of Lagom.
- Lagom's files, addresses and checks keep working unchanged.
- A wrong reference still fails the build.
- An article that cites two repositories says which commit of each it
  describes.

## Decision

1. **A project has a `kind`.** `platform` is Lagom's shape, unchanged.
   `practice` is a way of working applied across repositories: a title, a
   summary, an introduction, a stack, and `appliedIn`, the repositories that
   apply it, each linked to its rulebook. The content schema is a union on
   `kind`, and `scripts/check-projects.mjs` refuses an unknown kind.
2. **A practice has one ordered list of articles.** Its page is
   `/projects/<id>/` and each article `/projects/<id>/<slug>/`, from the files
   in `src/content/articles/<id>/`. A practice article names no group or
   subproject; the check refuses one that does, and refuses a practice id
   equal to a section id, since both own a directory of articles.
3. **A practice article is pinned per repository.** `pins` lists one commit
   for each repository it cites, `lagom` or `ofantini.com`, and the page
   links to each. Lagom articles keep `lagom_commit`.
4. **Agentic Development Patterns is the first practice,** applied in Lagom
   and in this site, with an operating model as its first article. The
   Projects page shows it as a second card, the Articles page as a second
   group, and the Lagom hub links to it from the platform part. Its stack
   names Claude Code and GitHub Actions with their Simple Icons logos, and
   Codex, Antigravity, T3 Code and gitleaks by name, as ADR-0003 asks for a
   technology without a logo in Simple Icons or its own repository.

## Consequences

**Positive.** A way of working that spans repositories has a place, and a
third repository that adopts it is one more entry in `appliedIn`. A later
project that is neither a platform nor a practice still needs a new kind,
which keeps the shapes explicit.

**Negative.** Two article layouts and two route families exist, one per
kind. The `pins` list names only the two repositories the site knows; a
practice article citing a third needs the enum widened.

## Reversal

Delete `src/content/projects/agentic-patterns.json` and its articles, the
practice routes, `src/lib/practices.ts`, `src/content/Practice.astro` and
`src/layouts/PracticeArticle.astro`, and remove `kind` and `pins` from the
schema, the check and the contract test.
