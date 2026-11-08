import { chromium, firefox, webkit } from 'playwright';
import { readdir } from 'node:fs/promises';
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
const articles = all.filter(route => /^\/projects\/lagom\/[^/]+\/$/.test(route));
assert.equal(articles.length, 5);
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
      if (articles.includes(route)) {
        assert.equal(await page.locator(`.article-links a[href="/projects/lagom/"]`).count(), 1, `${route}: link to Lagom`);
        assert.equal(await page.locator(`.article-trail a[href="/projects/lagom/"]`).count(), 1, `${route}: Lagom breadcrumb`);
      }
    }
    await page.goto(new URL('/projects/lagom/', base).href);
    for (const route of articles) assert.equal(await page.locator(`.win a[href="${route}"]`).count(), 1, `hub links to ${route}`);
    await page.goto(base);
    for (const route of articles) {
      await page.locator('.icons a[href="/articles/"]').click();
      await page.locator(`.win[data-url="/articles/"] a[href="${route}"]`).click();
      await page.locator(`.win[data-url="${route}"]`).waitFor();
    }
    assert.equal(await page.locator('.win[data-url^="/projects/lagom/"]').count(), 5);
    const duplicates = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    assert.deepEqual(duplicates, [], `${name}: unique IDs with every article open`);
    console.log(`${name}: ${all.length} page contracts and 5 simultaneous articles passed`);
  } finally { await browser.close(); }
}
