# ofantini.com

A static personal site built with Astro. Its home introduces Filipe Fantini. The
about page, opened from the `me.txt` desktop icon at `/about/`, describes his data work,
infrastructure hobby and outdoor interests, with a skills radar.
Projects lists Lagom, and Articles collects five short chapters about it. The Lagom
hub explains the small and medium data thesis and links each chapter to the project.
The ETL chapter records one USGS production run; its figures are pinned to a Lagom
commit in `src/data/figures.json`.

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
All tests assume that `npm run build` has run. On macOS, AirPlay Receiver can hold port
5000; the preview then starts on the next free port, so set `SITE_TEST_URL` to the
address it prints. Install the browsers once with `npx playwright install chromium firefox webkit`.

## Content and diagrams

Keep public professional information abstract: no employer, dates, location,
contact details or institutions. Write clear English without em or en dashes.
Articles carry a project reference, track, Lagom commit and ADR identifiers in
their frontmatter. The Astro content schema validates project references, and the build check exits
with an error if an article names a project that does not exist. Figures must cite lines in a fixed Lagom commit.

Mermaid sources live in `src/content/diagrams/`; their SVG images live in
`public/diagrams/`. When a diagram changes, run `npm run diagrams` locally and
commit both files. This command downloads the pinned Mermaid CLI temporarily and
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

## License

Code is licensed under MIT. Original editorial content in `src/content/` is
licensed under CC BY 4.0. Source excerpts and linked projects keep their own
licenses.
