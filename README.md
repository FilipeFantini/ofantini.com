# ofantini.com

A static personal site built with Astro. Its home introduces Filipe Fantini. The
about page, opened from the `me.txt` desktop icon at `/about/`, describes his data work,
infrastructure hobby and outdoor interests, with a skills radar.
Projects presents Lagom with its tracks and articles, and Articles lists every article
by project and track. The Lagom hub explains the small and medium data thesis and maps
its tracks; each track has a page, and each article its own page under it. The ETL
article records one USGS production run; its figures are pinned to a Lagom commit in
`src/data/figures.json`.

## Build and preview

Use Node.js 22.12 or newer:

```sh
npm ci
npm run build
npm run preview -- --port 5000
```

The build writes only static HTML, CSS, JavaScript, fonts and SVG images to `dist/`.
Astro and every package version are fixed in `package-lock.json`. No analytics,
cookies, external scripts or browser downloads run in the site. Fonts and diagrams
are served from the site itself. The build checks figure links, skill scores,
article project references, diagram hashes, copy and the 5 KiB gzip budget for JavaScript.

Run `node tests/navigation.mjs`, `node tests/radar.mjs`, `node tests/desktop.mjs`,
`node tests/accessibility.mjs` and `node tests/contract.mjs` against the preview.
They use Chromium, Firefox and WebKit on port 5000 unless `SITE_TEST_URL` is set.
The browser tests assume that `npm run build` has run. On macOS, AirPlay Receiver can hold port
5000; the preview then starts on the next free port, so set `SITE_TEST_URL` to the
address it prints. Install the browsers once with `npx playwright install chromium firefox webkit`.

`node tests/checks.mjs` needs neither a build nor a preview. It runs each build check
against the real content (must pass) and against a bad fixture in `tests/fixtures/`
(must fail and name the defect). `check-js-budget` takes no path, so it is not covered there.

## Deployment

Cloudflare Pages builds and serves the site through its own Git integration,
not through GitHub Actions (Lagom's ADR-0039, Decision 5). When a commit lands on
`main`, Cloudflare clones the repository, runs the build, and publishes `dist/`
to its network. Nothing else runs: the site is static files.

| Setting | Value |
|---|---|
| Pages project | `ofantini`, also served at `ofantini.pages.dev` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `22` |
| Preview branches | none: a branch is never published |
| Custom domain | `ofantini.com`, a proxied CNAME to `ofantini.pages.dev`, created by Pages |
| GitHub access | the Cloudflare app, installed on this repository only |

Previews stay off because Pages would otherwise publish every branch at a public
address before any check ([ADR-0001](docs/adr/0001-how-a-change-reaches-main.md)).
A failed Cloudflare build leaves the previous deployment online. To roll back,
revert the commit on `main` through a pull request; the project's Deployments
tab in Cloudflare can also roll back to an earlier deployment at once.

## Content and diagrams

Keep public professional information abstract: no employer, dates, location,
contact details or institutions. Write clear English without em or en dashes.
The project and its tracks live in `src/content/projects/lagom.json`: a title, a
summary and the track list, in the order shown on the site. A track with no articles
shows as "In works" and has no page.

To add an article, create `src/content/articles/<track>/<slug>.md`, where `<track>` is
a track id of the project and `<slug>` becomes the last part of its URL. Its frontmatter
is `title`, `summary` (one sentence, shown in lists), `project: lagom`, `track`, `order`
(a positive integer, its position within the track, unique per track), `lagom_commit`
(40 hex characters; the page links to it) and `adrs`. Nothing else needs editing: the
hub, the track page, Projects and Articles are generated from the collections. The
Astro content schema validates the fields, and the build check exits with an error if
an article names a project or track that does not exist, sits outside its track's
directory, or shares an `order` with another article of its track. Figures must cite
lines in a fixed Lagom commit.

Mermaid sources live in `src/content/diagrams/`; their SVG images live in
`public/diagrams/`. When a diagram changes, run `npm run diagrams` locally and
commit both files. An article embeds a diagram as `![alt text](/diagrams/<name>.svg)`.
Mermaid animated edges (`A e1@--> B` with `e1@{ animate: true }`) work through CSS that
Mermaid embeds in the SVG; `npm run diagrams` adds a `prefers-reduced-motion` rule that
stops every animation, and the build fails for an SVG that has animation CSS without
it. This command downloads the pinned Mermaid CLI temporarily and
uses a local browser. The site build only checks the source hash in each SVG, so
Cloudflare Pages does not need a browser for diagrams.

## Interaction and accessibility

On screens at least 701 px wide and 560 px high, local JavaScript opens linked
pages as movable, resizable windows on one desktop. New windows start at up to
720 by 480 px and cascade by 32 px, leaving earlier title bars reachable. The
address bar records the front window only. Reloading or sharing that address opens that page by itself.
Every window is also a real page with its own URL; with JavaScript disabled,
ordinary links still work. Smaller screens use normal page scrolling. Reduced
motion disables window animations. Text uses solid surfaces and the browser tests
check contrast, keyboard access and horizontal overflow.

## Working on this repository

A merge to `main` publishes the site. Every change goes through a pull request
with four required checks; the rules for agents and humans are in
[`AGENTS.md`](AGENTS.md), and the reasons in
[`docs/adr/0001-how-a-change-reaches-main.md`](docs/adr/0001-how-a-change-reaches-main.md).

## License

Code is licensed under MIT ([`LICENSE`](LICENSE)). Original editorial content in
`src/content/` is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source excerpts and linked projects keep their own
licenses.
