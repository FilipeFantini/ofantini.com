import { chromium, firefox, webkit } from 'playwright';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
async function pages(dir, route = '/') {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = entries.some(entry => entry.name === 'index.html') ? [route] : [];
  for (const entry of entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))) results.push(...await pages(join(dir, entry.name), `${route}${entry.name}/`));
  return results;
}
const routes = await pages('dist');
const base = process.env.SITE_TEST_URL || 'http://localhost:5000';
const failures = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
      const page = await browser.newPage({ viewport });
      for (const route of routes) {
        const response = await page.goto(new URL(route, base).href);
        assert.ok(response?.ok(), `${name} ${viewport.width} ${route}: HTTP ${response?.status()}`);
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        if (overflow) failures.push(`${name} ${viewport.width} ${route}: horizontal overflow`);
        // On a desktop window the page body scrolls inside a clipped box. axe reports a
        // heading cut by the box edge as "incomplete" (background overlapped by the
        // desk), which depends on where the text happens to fall. Show the whole body
        // so every element is judged on its own colours, not on its scroll position.
        await page.addStyleTag({ content: '.win,.win .body{height:auto!important;max-height:none!important;overflow:visible!important}' });
        await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
        const result = await page.evaluate(async () => {
          const report = await axe.run(document, { runOnly: ['color-contrast', 'scrollable-region-focusable'] });
          return [...report.violations, ...report.incomplete].map(item => `${item.id}: ${item.nodes.length} elements`);
        });
        if (result.length) failures.push(`${name} ${viewport.width} ${route}: ${result.join(', ')}`);
      }
      await page.close();
    }
    console.log(`${name}: ${routes.length} pages at 375 and 1280 px checked`);
  } finally { await browser.close(); }
}
for (const failure of failures) console.error(failure);
assert.equal(failures.length, 0, `${failures.length} accessibility checks failed`);
console.log('Accessibility checks passed in three browsers');
