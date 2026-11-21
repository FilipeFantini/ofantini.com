# ADR-0006 — Articles carry a published and an updated day

- **Status:** Accepted, by the operator approving the pull request that adds it
- **Date:** 2026-11-21
- **Decided by:** the operator, on 2026-11-21: each project and article should
  show when it was published or updated, so a visitor can tell what is new.

## Context and problem

No page said when an article went live or last changed. Every article is
pinned to a commit, which dates the facts it describes, but not the article
itself: an article rewritten today still pointed to the same commit as
before. A returning visitor could not tell a new article from an old one.

## Requirements and constraints

- Each article shows the day it was published and, if its text changed later
  in substance, the day of that update.
- Lists and project cards show enough to spot what is new.
- The build stays reproducible from the repository alone, and a wrong date
  fails it.

## Alternatives considered

**Dates from Git history at build time.** No field to maintain, but the date
of a commit is not the date of a publication: a typo fix, a moved file or a
merge would all count as updates, and a shallow clone has no history to read.
Cloudflare's build would then depend on how deep it clones.

**One date only.** Simpler, but "updated" alone hides how old an article is,
and "published" alone hides a rewrite.

## Decision

1. **Two frontmatter fields.** `published` is the day the article first went
   live on the site; `updated`, optional, is the day its text last changed in
   substance, and must be after `published`. A typo fix does not move it; a
   rewrite or a changed fact does. Both are calendar days in ISO form
   (`2026-11-21`), the form the articles already use in their text.
2. **Where they show.** An article page shows both under its pinned commit.
   Every article list shows the latest of the two beside the title, labelled
   "Published" or "Updated". A project card shows "Updated" with the latest
   change among its articles, so a project needs no date of its own.
3. **Checks.** The content schema parses both dates and refuses an update not
   after the publication; `scripts/check-projects.mjs` refuses a missing or
   impossible day before Astro runs, with a fixture that proves it; the
   contract test compares every article page and every project card with the
   frontmatter.
4. **First values.** Each article's `published` is the day it was first added
   to this repository (2026-11-09 for the first eleven, 2026-11-15 for the
   earthquake dashboard, 2026-11-21 for the operating model). The twelve
   older articles carry `updated: 2026-11-21`, the day they were rewritten.

## Consequences

**Positive.** What is new is visible on every list, and a project card says
how recently it moved.

**Negative.** `updated` is set by hand: an agent or the operator must
remember to move it when an article changes in substance. The reviewer reads
the diff and can catch a rewrite that leaves it behind; no check can tell a
substantive change from a small one.

## Reversal

Remove `published` and `updated` from the articles, the schema, the check,
the fixture, `ArticleDates.astro`, `src/lib/dates.ts`, the list, the card and
the contract test.
