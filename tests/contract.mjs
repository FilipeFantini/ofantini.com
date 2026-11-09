import { chromium, firefox, webkit } from 'playwright';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
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
const tracks = all.filter(route => /^\/projects\/lagom\/[^/]+\/$/.test(route));
const articles = all.filter(route => /^\/projects\/lagom\/[^/]+\/[^/]+\/$/.test(route));
const sources = (await readdir('src/content/articles', { recursive: true })).filter(file => file.endsWith('.md'));
assert.equal(articles.length, sources.length, 'one page per article file');
assert.ok(tracks.length > 0 && articles.length >= tracks.length, 'every track page has at least one article page');
const base = process.env.SITE_TEST_URL || 'http://localhost:5000';
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    for (const route of all) {
      await page.goto(new URL(route, base).href);
      assert.equal(await page.locator('.wins > .win[data-url]').count(), 1, `${route}: one window`);
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
      if (tracks.includes(route) || articles.includes(route)) {
        assert.equal(await page.locator(`.article-trail a[href="/projects/lagom/"]`).count(), 1, `${route}: Lagom breadcrumb`);
      }
      if (tracks.includes(route)) {
        assert.ok(await page.locator('.win .articles a').count() > 0, `${route}: track page lists its articles`);
        const links = await page.locator('.win .articles a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
        for (const link of links) assert.ok(articles.includes(link) && link.startsWith(route), `${route}: lists ${link}`);
      }
      if (articles.includes(route)) {
        const track = route.split('/').slice(0, 4).join('/') + '/';
        assert.equal(await page.locator(`.article-links a[href="/projects/lagom/"]`).count(), 1, `${route}: link to Lagom`);
        assert.equal(await page.locator(`.article-trail a[href="${track}"]`).count(), 1, `${route}: track breadcrumb`);
        assert.equal(await page.locator('.win .t').textContent().then(text => /^Lagom \/ .+ \/ \d\d$/.test(text)), true, `${route}: window title`);
        assert.equal(await page.locator('.article-pin a[href^="https://github.com/FilipeFantini/lagom/tree/"]').count(), 1, `${route}: pinned commit`);
        assert.ok(await page.locator('.article-content p.sources a[href^="https://github.com/FilipeFantini/lagom/blob/"]').count() > 0, `${route}: source lines marked`);
        assert.equal(await page.locator('.article-content p:not(.sources) > a:first-child:only-child[href*="/lagom/blob/"]').count(), 0, `${route}: no unmarked source line`);
      }
    }
    await page.goto(new URL('/projects/lagom/', base).href);
    // The hub links to each track page; each track page, the Projects page and
    // the Articles page link to every article.
    for (const route of tracks) assert.equal(await page.locator(`.win .map a[href="${route}"]`).count(), 1, `hub links to ${route}`);
    for (const route of articles) {
      const track = route.split('/').slice(0, 4).join('/') + '/';
      assert.ok(tracks.includes(track), `${route}: its track page exists`);
      for (const list of ['/projects/', '/articles/', track]) {
        await page.goto(new URL(list, base).href);
        assert.equal(await page.locator(`.win a[href="${route}"]`).count(), 1, `${list} links to ${route}`);
      }
    }
    await page.goto(base);
    for (const route of articles) {
      await page.locator('.icons a[href="/articles/"]').click();
      await page.locator(`.win[data-url="/articles/"] a[href="${route}"]`).click();
      await page.locator(`.win[data-url="${route}"]`).waitFor();
    }
    assert.equal(await page.locator('.win[data-url^="/projects/lagom/"]').count(), articles.length);
    const duplicates = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    assert.deepEqual(duplicates, [], `${name}: unique IDs with every article open`);
    console.log(`${name}: ${all.length} page contracts and ${articles.length} simultaneous articles passed`);
  } finally { await browser.close(); }
}
