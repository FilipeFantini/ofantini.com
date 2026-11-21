import { chromium, firefox, webkit } from 'playwright';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import assert from 'node:assert/strict';

async function routes(dir, route = '/') {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = entries.some(entry => entry.name === 'index.html') ? [route] : [];
  for (const entry of entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))) {
    found.push(...await routes(join(dir, entry.name), `${route}${entry.name}/`));
  }
  return found;
}

const all = await routes('dist');
// Pages serves dist/404.html with status 404 for unknown addresses; without it,
// every unknown address would answer with the home page and status 200.
const notFound = await readFile('dist/404.html', 'utf8');
assert.ok(notFound.includes('Nothing here.') && notFound.includes('href="/"'), '404 page with a link home');
// A section is a platform group or a data subproject, with a page at
// /projects/lagom/<id>/ once it has articles; its articles sit under it.
const sections = all.filter(route => /^\/projects\/lagom\/[^/]+\/$/.test(route));
const articles = all.filter(route => /^\/projects\/lagom\/[^/]+\/[^/]+\/$/.test(route));
const sources = (await readdir('src/content/articles', { recursive: true })).filter(file => file.endsWith('.md'));
// A practice project (ADR-0005) has a page at /projects/<id>/ and its
// articles under it; its article files live in src/content/articles/<id>/.
const practices = [];
for (const file of (await readdir('src/content/projects')).filter(file => file.endsWith('.json'))) {
  const project = JSON.parse(await readFile(join('src/content/projects', file), 'utf8'));
  if (project.kind === 'practice') practices.push({ id: basename(file, '.json'), ...project, page: `/projects/${basename(file, '.json')}/` });
}
const practicePages = practices.map(practice => practice.page);
const practiceArticles = all.filter(route => practices.some(practice => route.startsWith(practice.page) && route !== practice.page));
for (const page of practicePages) assert.ok(all.includes(page), `${page}: practice page built`);
assert.equal(articles.length + practiceArticles.length, sources.length, 'one page per article file');
// Each article's dates from its frontmatter, by route (ADR-0006), and the
// latest change of each project's articles, which its card shows.
const dates = new Map();
for (const file of sources) {
  const text = await readFile(join('src/content/articles', file), 'utf8');
  const [dir, slug] = [dirname(file), basename(file, '.md')];
  const route = practices.some(practice => practice.id === dir) ? `/projects/${dir}/${slug}/` : `/projects/lagom/${dir}/${slug}/`;
  // A day may be written with or without quotes, as the project check allows.
  const day = name => new RegExp(`^${name}:\\s*["']?([0-9]{4}-[0-9]{2}-[0-9]{2})["']?`, 'm').exec(text)?.[1];
  dates.set(route, { published: day('published'), updated: day('updated') });
}
const latestOf = routes => routes.map(route => dates.get(route).updated ?? dates.get(route).published).sort().at(-1);
assert.ok(sections.length > 0 && articles.length >= sections.length, 'every section page has at least one article page');
const lagom = JSON.parse(await readFile('src/content/projects/lagom.json', 'utf8'));
const groupRoutes = lagom.platform.groups.map(group => `/projects/lagom/${group.id}/`).filter(route => sections.includes(route));
const subprojectRoutes = lagom.subprojects.map(subproject => `/projects/lagom/${subproject.id}/`).filter(route => sections.includes(route));
assert.deepEqual([...groupRoutes, ...subprojectRoutes].sort(), [...sections].sort(), 'every section page is a group or a subproject');
// The kind of each subproject article, read from its frontmatter.
const kinds = new Map();
for (const file of sources) {
  const kind = /^kind:\s*(\w+)/m.exec(await readFile(join('src/content/articles', file), 'utf8'))?.[1];
  if (kind) kinds.set(`/projects/lagom/${dirname(file)}/${basename(file, '.md')}/`, kind);
}
// Pages serves public/_redirects; an old address must not be a page any more,
// and the address it moves to must be one.
const redirects = (await readFile('dist/_redirects', 'utf8')).split('\n').filter(line => line.trim() && !line.startsWith('#'));
assert.ok(redirects.length > 0, 'redirects are published');
for (const line of redirects) {
  const [from, to, status, ...rest] = line.trim().split(/\s+/);
  assert.equal(status, '301', `${line}: permanent redirect`);
  assert.equal(rest.length, 0, `${line}: three fields`);
  assert.ok(!all.includes(from.endsWith('/') ? from : `${from}/`), `${from}: redirected but still a page`);
  assert.ok(all.includes(to), `${from}: redirects to ${to}, which is not a page`);
}
const base = process.env.SITE_TEST_URL || 'http://localhost:5000';
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    for (const route of all) {
      await page.goto(new URL(route, base).href);
      assert.equal(await page.locator('.wins > .win[data-url]').count(), 1, `${route}: one window`);
      assert.equal(await page.locator('head link[rel="icon"][href="/favicon.svg"]').count(), 1, `${route}: favicon`);
      assert.equal(await page.locator('.win script').count(), 0, `${route}: no script in window`);
      assert.equal(await page.locator('.site-header a[href="/"]').count(), 1, `${route}: home wordmark`);
      assert.equal(await page.locator('.site-header a[href="/"] .dot').count(), 1, `${route}: red wordmark dot`);
      assert.equal(await page.locator('.win .close[href="/"]').count(), 1, `${route}: close control`);
      assert.equal(await page.locator('.win .body[tabindex="0"][role="region"]').count(), 1, `${route}: keyboard scroll region`);
      assert.equal(await page.locator('.icons a[href^="/notes"], .task a[href^="/notes"]').count(), 0, `${route}: no old navigation route`);
      if (route !== '/') {
        assert.equal(await page.locator('.win .back[href]').count(), 1, `${route}: back`);
        assert.equal(await page.locator('.win .home[href="/"]').count(), 1, `${route}: home`);
      }
      if (sections.includes(route) || articles.includes(route)) {
        assert.equal(await page.locator(`.article-trail a[href="/projects/lagom/"]`).count(), 1, `${route}: Lagom breadcrumb`);
      }
      if (sections.includes(route)) {
        assert.ok(await page.locator('.win .articles a').count() > 0, `${route}: section page lists its articles`);
        const links = await page.locator('.win .articles a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
        for (const link of links) assert.ok(articles.includes(link) && link.startsWith(route), `${route}: lists ${link}`);
      }
      if (articles.includes(route)) {
        const section = route.split('/').slice(0, 4).join('/') + '/';
        assert.equal(await page.locator(`.article-links a[href="/projects/lagom/"]`).count(), 1, `${route}: link to Lagom`);
        assert.equal(await page.locator(`.article-trail a[href="${section}"]`).count(), 1, `${route}: section breadcrumb`);
        assert.equal(await page.locator('.win .t').textContent().then(text => /^Lagom \/ .+ \/ \d\d$/.test(text)), true, `${route}: window title`);
        assert.ok(await page.locator('.article-content p.sources a[href^="https://github.com/FilipeFantini/lagom/blob/"]').count() > 0, `${route}: source lines marked`);
        assert.equal(await page.locator('.article-content p:not(.sources) > a:first-child:only-child[href*="/lagom/blob/"]').count(), 0, `${route}: no unmarked source line`);
      }
      if (dates.has(route)) {
        const { published, updated } = dates.get(route);
        const shown = await page.locator('.article-dates time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime')));
        assert.deepEqual(shown, updated ? [published, updated] : [published], `${route}: published and updated dates`);
      }
      if (practicePages.includes(route)) {
        assert.ok(await page.locator('.win .articles a').count() > 0, `${route}: practice page lists its articles`);
        const links = await page.locator('.win .articles a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
        for (const link of links) assert.ok(practiceArticles.includes(link) && link.startsWith(route), `${route}: lists ${link}`);
      }
      if (practiceArticles.includes(route)) {
        const practice = practices.find(item => route.startsWith(item.page));
        assert.equal(await page.locator(`.article-trail a[href="${practice.page}"]`).count(), 1, `${route}: practice breadcrumb`);
        assert.equal(await page.locator(`.article-links a[href="${practice.page}"]`).count(), 1, `${route}: link to its practice`);
        assert.ok(await page.locator('.win .t').textContent().then(text => text.startsWith(`${practice.title} / `) && /\/ \d\d$/.test(text)), `${route}: window title`);
        assert.ok(await page.locator('.article-content p.sources a[href^="https://github.com/FilipeFantini/"][href*="/blob/"]').count() > 0, `${route}: source lines marked`);
        assert.equal(await page.locator('.article-content p:not(.sources) > a:first-child:only-child[href*="/blob/"]').count(), 0, `${route}: no unmarked source line`);
      }
    }
    // The Projects page shows each project as a card: its own links under its
    // summary, every technology of its platform and sources once, and a link to
    // its page, but none of its articles, which live on that page.
    await page.goto(new URL('/projects/', base).href);
    assert.equal(await page.locator('.win .project-card h2 a[href="/projects/lagom/"]').count(), 1, '/projects/: Lagom card links to its page');
    const stack = [...new Set([lagom.platform.stack, ...lagom.subprojects.map(subproject => subproject.stack)].flat())];
    assert.equal(await page.locator('.win .project-card[aria-labelledby="project-lagom"] .stack li').count(), stack.length, '/projects/: card lists every technology once');
    for (const route of [...articles, ...practiceArticles]) assert.equal(await page.locator(`.win a[href="${route}"]`).count(), 0, `/projects/ does not list ${route}`);
    for (const practice of practices) assert.equal(await page.locator(`.win .project-card h2 a[href="${practice.page}"]`).count(), 1, `/projects/: card links to ${practice.page}`);
    assert.equal(await page.locator('.win .project-card[aria-labelledby="project-lagom"] .project-parts time').getAttribute('datetime'), latestOf(articles), '/projects/: Lagom card shows its latest change');
    for (const practice of practices) {
      const own = practiceArticles.filter(route => route.startsWith(practice.page));
      assert.equal(await page.locator(`.win .project-card[aria-labelledby="project-${practice.id}"] .project-parts time`).getAttribute('datetime'), latestOf(own), `/projects/: ${practice.id} card shows its latest change`);
    }
    await page.goto(new URL('/articles/', base).href);
    assert.equal(await page.locator('.win .articles li').count(), await page.locator('.win .articles li .date time[datetime]').count(), '/articles/: every listed article shows a date');
    await page.goto(new URL('/projects/', base).href);
    for (const { label, href } of lagom.links) {
      assert.equal(await page.locator(`.win .project-links a[href="${href}"]`).count(), 1, `/projects/ links to ${href}`);
      assert.match(await page.locator(`.win .project-links a[href="${href}"]`).textContent(), new RegExp(`^${label}`), `/projects/: ${href} labelled ${label}`);
    }
    // The About page ends with the operator's portrait, served by the site
    // itself, and links to LinkedIn and GitHub.
    await page.goto(new URL('/about/', base).href);
    const portrait = page.locator('.win .signature img');
    await portrait.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.win .signature img')?.complete);
    const image = await portrait.evaluate(node => ({ src: node.currentSrc, width: node.naturalWidth, alt: node.getAttribute('alt') }));
    assert.equal(new URL(image.src).origin, new URL(base).origin, '/about/: portrait served by the site');
    assert.match(new URL(image.src).pathname, /\.webp$/, '/about/: portrait is WebP');
    assert.ok(image.width >= 72, '/about/: portrait loads');
    assert.equal(image.alt, '', '/about/: portrait is decorative beside the name');
    assert.equal(await page.locator('.win .signature .name').textContent(), 'Filipe Fantini', '/about/: name beside the portrait');
    assert.equal(await page.locator('.win .signature a[href="https://www.linkedin.com/in/filipe-fantini/"]').count(), 1, '/about/: LinkedIn link');
    assert.equal(await page.locator('.win .signature a[href="https://github.com/FilipeFantini"]').count(), 1, '/about/: GitHub link');
    await page.goto(new URL('/projects/lagom/', base).href);
    // The hub links to each group page from the platform map and to each
    // subproject page from its card; each section page and the Articles page
    // link to every article.
    for (const route of groupRoutes) assert.equal(await page.locator(`.win .map a[href="${route}"]`).count(), 1, `hub map links to ${route}`);
    for (const route of subprojectRoutes) assert.equal(await page.locator(`.win .data-card a[href="${route}"]`).count(), 1, `hub card links to ${route}`);
    assert.equal(await page.locator('.win .data-card').count(), lagom.subprojects.length, 'hub has one card per subproject');
    for (const route of articles) {
      const section = route.split('/').slice(0, 4).join('/') + '/';
      assert.ok(sections.includes(section), `${route}: its section page exists`);
      assert.equal(kinds.has(route), subprojectRoutes.includes(section), `${route}: a kind exactly when it belongs to a subproject`);
      if (kinds.has(route)) {
        const id = section.split('/')[3];
        await page.goto(new URL(section, base).href);
        assert.equal(await page.locator(`.win section[aria-labelledby="${id}-${kinds.get(route)}"] .articles a[href="${route}"]`).count(), 1, `${section} lists ${route} under ${kinds.get(route)}`);
      }
      for (const list of ['/articles/', section]) {
        await page.goto(new URL(list, base).href);
        assert.equal(await page.locator(`.win a[href="${route}"]`).count(), 1, `${list} links to ${route}`);
      }
    }
    for (const route of practiceArticles) {
      const practice = practices.find(item => route.startsWith(item.page));
      for (const list of ['/articles/', practice.page]) {
        await page.goto(new URL(list, base).href);
        assert.equal(await page.locator(`.win a[href="${route}"]`).count(), 1, `${list} links to ${route}`);
      }
    }
    await page.goto(base);
    for (const route of [...articles, ...practiceArticles]) {
      await page.locator('.icons a[href="/articles/"]').click();
      await page.locator(`.win[data-url="/articles/"] a[href="${route}"]`).click();
      await page.locator(`.win[data-url="${route}"]`).waitFor();
    }
    assert.equal(await page.locator('.win[data-url^="/projects/"]').count(), articles.length + practiceArticles.length);
    const duplicates = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    assert.deepEqual(duplicates, [], `${name}: unique IDs with every article open`);
    console.log(`${name}: ${all.length} page contracts and ${articles.length + practiceArticles.length} simultaneous articles passed`);
  } finally { await browser.close(); }
}
