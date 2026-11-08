import { chromium, firefox, webkit } from 'playwright';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

async function pages(dir, route = '/') {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = entries.some(entry => entry.name === 'index.html') ? [route] : [];
  for (const entry of entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))) {
    results.push(...await pages(join(dir, entry.name), `${route}${entry.name}/`));
  }
  return results;
}
const routes = await pages('dist');
const base = process.env.SITE_TEST_URL || 'http://localhost:5000';
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const route of routes) {
      await page.goto(`${base}${route}`);
      if (route !== '/') {
        assert.equal(await page.locator('[data-back]').count(), 1, `${route}: back link`);
        assert.ok(await page.locator('a[aria-label="Home"][href="/"]').count(), `${route}: home link`);
      }
      assert.ok(await page.getByRole('link', { name: /ofantini\s*\.\s*com/i }).count(), `${route}: wordmark`);
    }
    await page.goto(new URL('/articles/', base).href);
    await page.getByRole('link', { name: 'When the small node stopped fitting', exact: true }).click();
    await page.locator('.win[data-url="/projects/lagom/infrastructure/small-node/"]').waitFor();
    await page.locator('[data-back]').click();
    await page.waitForURL('**/articles/');
    const noJs = await browser.newPage({ javaScriptEnabled: false });
    await noJs.goto(new URL('/projects/lagom/', base).href);
    await noJs.locator('[data-back]').click();
    await noJs.waitForURL('**/projects/');
    await noJs.close();
    console.log(`${name}: ${routes.length} pages, history and no-JS fallback passed`);
  } finally { await browser.close(); }
}
