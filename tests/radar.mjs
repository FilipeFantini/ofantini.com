import { chromium, firefox, webkit } from 'playwright';
import { strict as assert } from 'node:assert';

const base = process.env.SITE_TEST_URL || 'http://localhost:5000';
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
    for (const width of [320, 375, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      await page.goto(new URL('/about/', base).href);
      await page.evaluate(() => document.fonts.ready);
      const result = await page.evaluate(() => {
        const visible = (element) => getComputedStyle(element).display !== 'none';
        const plot = [...document.querySelectorAll('.radar-plot')].find(visible);
        const svg = plot.querySelector('svg');
        const rings = [...svg.querySelectorAll('polygon.grid')];
        const points = [...svg.querySelectorAll('circle.points')].map((point) => [
          Number(point.getAttribute('cx')),
          Number(point.getAttribute('cy')),
        ]);
        const outer = rings
          .at(-1)
          .getAttribute('points')
          .trim()
          .split(/\s+/)
          .map((pair) => pair.split(',').map(Number));
        const rect = plot.getBoundingClientRect();
        const [vbX, vbY, vbW, vbH] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
        const svgRect = svg.getBoundingClientRect();
        const toScreen = (x, y) => ({
          x: svgRect.left + ((x - vbX) / vbW) * svgRect.width,
          y: svgRect.top + ((y - vbY) / vbH) * svgRect.height,
        });

        const htmlLabels = [...plot.querySelectorAll('.radar-label')];
        const svgLabels = [...svg.querySelectorAll('.radar-svg-label')];
        const labelNodes = htmlLabels.length ? htmlLabels : svgLabels;
        const labelVisible = labelNodes.every((label) => {
          const style = getComputedStyle(label);
          return style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0;
        });
        const minFontSize = Math.min(...labelNodes.map((label) => parseFloat(getComputedStyle(label).fontSize)));
        const boxes = labelNodes.map((label) => {
          if (label.getBBox && label.ownerSVGElement) {
            const box = label.getBBox();
            const topLeft = toScreen(box.x, box.y);
            const bottomRight = toScreen(box.x + box.width, box.y + box.height);
            return {
              left: topLeft.x,
              top: topLeft.y,
              right: bottomRight.x,
              bottom: bottomRight.y,
              width: bottomRight.x - topLeft.x,
              height: bottomRight.y - topLeft.y,
            };
          }
          return label.getBoundingClientRect();
        });

        const clipped = labelNodes
          .filter((_, index) => {
            const box = boxes[index];
            return (
              box.left < rect.left - 1 ||
              box.right > rect.right + 1 ||
              box.top < rect.top - 1 ||
              box.bottom > rect.bottom + 1
            );
          })
          .map((label) => label.textContent);

        const overlap = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i];
            const b = boxes[j];
            if (
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
            ) {
              overlap.push([labelNodes[i].textContent, labelNodes[j].textContent]);
            }
          }
        }

        const vertices = outer.map(([x, y]) => toScreen(x, y));
        const distance = boxes.map((box, index) =>
          Math.hypot(
            box.left + box.width / 2 - vertices[index].x,
            box.top + box.height / 2 - vertices[index].y,
          ),
        );

        const drawingOverlap = plot.classList.contains('mobile')
          ? boxes.some((box) =>
            Math.min(box.right, svgRect.right) - Math.max(box.left, svgRect.left) > 1 &&
            Math.min(box.bottom, svgRect.bottom) - Math.max(box.top, svgRect.top) > 1)
          : false;
        const dot = document.querySelector('.site-header .dot');
        const dotBox = dot.getBoundingClientRect();
        const dotColor = getComputedStyle(dot).color;
        const list = [...document.querySelectorAll('.chart ul li')];
        const listBox = document.querySelector('.chart ul').getBoundingClientRect();
        const tools = [...document.querySelectorAll('.tools span')];
        const brokenTools = tools
          .filter((item) => item.getClientRects().length !== 1)
          .map((item) => item.textContent);

        return {
          brokenTools,
          clipped,
          overlap,
          drawingOverlap,
          labelVisible,
          minFontSize,
          dotWidth: dotBox.width,
          dotColor,
          distance,
          labels: labelNodes.map((label) => label.textContent),
          ringCount: rings.length,
          points,
          outer,
          list: list.map((item) => item.textContent),
          listHidden: listBox.width <= 1 && listBox.height <= 1,
          scroll: document.documentElement.scrollHeight > innerHeight,
        };
      });

      assert.deepEqual(result.brokenTools, [], `${name} ${width}: tool name wraps`);
      assert.deepEqual(result.clipped, [], `${name} ${width}: radar labels outside plot`);
      assert.deepEqual(result.overlap, [], `${name} ${width}: radar labels overlap`);
      assert.equal(result.drawingOverlap, false, `${name} ${width}: labels overlap radar drawing`);
      assert.equal(result.labelVisible, true, `${name} ${width}: radar labels are hidden`);
      assert.ok(result.minFontSize >= 12, `${name} ${width}: radar label below 12px`);
      assert.ok(result.dotWidth > 0, `${name} ${width}: wordmark dot is hidden`);
      assert.equal(result.dotColor, 'rgb(150, 55, 44)', `${name} ${width}: wrong wordmark dot color`);
      assert.equal(result.labels.length, 8);
      assert.ok(
        result.labels.every((label) => !/[()0-9]/.test(label)),
        `${name} ${width}: visible label has a score`,
      );
      assert.ok(
        result.distance.every((value) => value <= 90),
        `${name} ${width}: labels too far from vertices: ${result.distance}`,
      );
      assert.equal(result.ringCount, 7);
      assert.equal(result.list.length, 8);
      assert.equal(
        result.listHidden,
        true,
        `${name} ${width}: score list should be for screen readers only`,
      );
      for (const index of [1, 2]) {
        assert.deepEqual(result.points[index], result.outer[index], 'Score 7 should meet outer ring');
      }
      if (width === 1280) {
        assert.equal(result.scroll, false, `${name}: about page should fit without page scroll`);
      }
      console.log(`${name} ${width}: vertex labels, seven rings, score 7 and screen reader list passed`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
