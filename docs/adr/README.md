# Architecture Decision Records

One file per decision with lasting consequence, numbered in order. A decision
is reversed by a new ADR that supersedes it; the old one stays, marked as such.

Decisions about the site that were taken in Lagom, before the site had its own
repository, stay there: [Lagom's ADR index](https://github.com/FilipeFantini/lagom/blob/main/docs/adr/README.md),
ADR-0022 and ADR-0039 in particular.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-how-a-change-reaches-main.md) | How a change reaches `main`: the ruleset, the checks, the review and the operator's approval | Accepted |
| [0002](0002-frames-of-our-own-projects.md) | A page may frame a page of our own projects, sandboxed to scripts, from listed hosts | Accepted |
| [0003](0003-lagom-platform-and-data-projects.md) | Lagom in two parts: platform groups and one data project per source, with redirects and inlined Simple Icons logos | Accepted |
| [0004](0004-projects-as-packages.md) | The Projects page shows each project as one card, and Lagom's data projects are called sources | Accepted |
| [0005](0005-practice-projects.md) | A second kind of project, a practice applied across repositories, starting with Agentic Development Patterns | Accepted |
| [0006](0006-published-and-updated-dates.md) | Articles carry a published and an updated day in their frontmatter; pages, lists and project cards show them | Accepted |
| [0007](0007-no-commit-line-on-articles.md) | Article pages drop the line naming a pinned commit, and articles drop `lagom_commit` and `pins` | Accepted |
