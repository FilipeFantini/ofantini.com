import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.SITE_TEST_URL || 'http://localhost:5000';
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('.icons a[href="/about/"]').click();
    await page.locator('.win[data-url="/about/"]').waitFor();
    assert.equal(await page.locator('.win').count(), 2);
    assert.equal(new URL(page.url()).pathname, '/about/');
    await page.locator('.icons a[href="/projects/"]').click();
    await page.locator('.win[data-url="/projects/"]').waitFor();
    assert.equal(await page.locator('.win').count(), 3);
    assert.equal(await page.locator('.task a[aria-current]').count(), 1);
    await page.waitForFunction(() => !document.querySelector('.win.opening'));
    const cascade = await page.locator('.win').evaluateAll(nodes => nodes.map(node => ({
      x: node.getBoundingClientRect().x,
      y: node.getBoundingClientRect().y,
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    })));
    assert.equal(cascade.length, 3);
    assert.equal(cascade[1].x - cascade[0].x, 32, `${name}: second window x cascade`);
    assert.equal(cascade[1].y - cascade[0].y, 32, `${name}: second window y cascade`);
    assert.equal(cascade[2].x - cascade[1].x, 32, `${name}: third window x cascade`);
    assert.equal(cascade[2].y - cascade[1].y, 32, `${name}: third window y cascade`);
    assert.ok(cascade[1].width < cascade[0].width && cascade[1].height < cascade[0].height, `${name}: new windows are smaller`);
    for (const url of ['/projects/', '/about/', '/']) {
      await page.locator(`.win[data-url="${url}"] .t`).click();
      assert.equal(await page.locator(`.win[data-url="${url}"]`).evaluate(node => node.style.zIndex),
        await page.locator('.win').evaluateAll(nodes => String(Math.max(...nodes.map(node => Number(node.style.zIndex))))),
        `${name}: title bar center should raise ${url}`);
    }
    await page.locator('.task a[href="/projects/"]').click();
    const project = page.locator('.win[data-url="/projects/"]');
    const bar = project.locator('.bar');
    const before = await project.boundingBox();
    await page.mouse.move(before.x + 350, before.y + 18);
    await page.mouse.down(); await page.mouse.move(before.x + 300, before.y - 2, { steps: 4 }); await page.mouse.up();
    const moved = await project.boundingBox();
    assert.ok(moved.x < before.x - 25 && moved.y < before.y - 10, `${name}: opened window drags`);
    const grip = project.locator('.grip');
    const gripBox = await grip.boundingBox();
    await page.mouse.move(gripBox.x + 10, gripBox.y + 10);
    await page.mouse.down(); await page.mouse.move(gripBox.x - 40, gripBox.y - 30, { steps: 4 }); await page.mouse.up();
    const resized = await project.boundingBox();
    assert.ok(resized.width < moved.width - 25 && resized.height < moved.height - 15, `${name}: opened window resizes`);
    await project.locator('.max').click();
    assert.ok(await project.evaluate(node => node.classList.contains('maximized')));
    await project.locator('.max').click();
    assert.ok(!(await project.evaluate(node => node.classList.contains('maximized'))));
    await project.getByRole('link', { name: 'Lagom', exact: true }).click();
    await page.locator('.win[data-url="/projects/lagom/"]').waitFor();
    assert.equal(new URL(page.url()).pathname, '/projects/lagom/');
    await page.goBack();
    await page.waitForURL('**/projects/');
    assert.equal(new URL(page.url()).pathname, '/projects/');
    await page.goForward();
    await page.waitForURL('**/projects/lagom/');
    assert.equal(new URL(page.url()).pathname, '/projects/lagom/');
    await page.locator('.win[data-url="/projects/lagom/"] .back').click();
    await page.locator('.win[data-url="/projects/"]').waitFor();
    assert.equal(new URL(page.url()).pathname, '/projects/');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.win[data-url="/projects/"] .close').click();
    assert.equal(await page.locator('.win').count(), 2, `${name}: close with reduced motion`);
    await page.locator('.task a[href="/"]').click();
    await page.locator('.win[data-url="/"] .close').click();
    assert.equal(await page.locator('.win').count(), 1, `${name}: home window closes when others are open`);
    assert.equal(await page.locator('.win[data-url="/about/"]').count(), 1, `${name}: remaining window stays`);
    assert.deepEqual(errors, [], `${name}: page errors`);
    const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    await mobile.goto(base);
    await mobile.locator('.icons a[href="/about/"]').click();
    assert.equal(new URL(mobile.url()).pathname, '/about/');
    assert.equal(await mobile.locator('.win').count(), 1);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollHeight > innerHeight));
    await mobile.close();
    const plain = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
    await plain.goto(base);
    await plain.locator('.icons a[href="/projects/"]').click();
    assert.equal(new URL(plain.url()).pathname, '/projects/');
    await plain.locator('.back').click();
    assert.equal(new URL(plain.url()).pathname, '/');
    await plain.close();
    const reading = await browser.newPage({ viewport: { width: 1280, height: 600 } });
    await reading.goto(`${base}/projects/lagom/`);
    await reading.locator('.win .body').focus();
    await reading.keyboard.press('PageDown');
    await reading.waitForFunction(() => document.querySelector('.win .body')?.scrollTop > 0);
    assert.ok(await reading.locator('.win .body').evaluate(node => node.scrollTop > 0), `${name}: keyboard scrolls window`);
    assert.equal(await reading.evaluate(() => scrollY), 0, `${name}: desktop page stays still`);
    await reading.close();
    console.log(`${name}: desktop windows, drag, resize, maximize, history, close, keyboard scroll, mobile and no-JS passed`);
  } finally { await browser.close(); }
}
