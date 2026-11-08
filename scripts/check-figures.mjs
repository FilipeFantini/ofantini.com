import { readFile } from 'node:fs/promises';

const path = process.argv[2] || 'src/data/figures.json';
const figures = JSON.parse(await readFile(path, 'utf8'));
const sourcePattern = /^https:\/\/github\.com\/FilipeFantini\/lagom\/blob\/[0-9a-f]{40}\/docs\/[\w./-]+#L\d+(?:-L\d+)?$/;
if (!Array.isArray(figures) || figures.length === 0) throw new Error('Figures must be a nonempty array');
for (const figure of figures) {
  if (!figure.value || !figure.context || !sourcePattern.test(figure.source)) {
    throw new Error(`Invalid figure or pinned source: ${JSON.stringify(figure)}`);
  }
  const page = await readFile(figure.page, 'utf8');
  if (!page.includes(figure.value) || !page.includes(figure.source)) {
    throw new Error(`Figure or source missing from ${figure.page}: ${figure.value}`);
  }
}
console.log(`Checked ${figures.length} figures and pinned sources`);
