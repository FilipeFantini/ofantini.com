import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const sourceDir = process.argv[2] || 'src/content/diagrams';
const outputDir = process.argv[3] || 'public/diagrams';
for (const file of (await readdir(sourceDir)).filter(name => name.endsWith('.mmd'))) {
  const source = await readFile(join(sourceDir, file));
  const digest = createHash('sha256').update(source).digest('hex');
  const svgPath = join(outputDir, file.replace(/\.mmd$/, '.svg'));
  let svg;
  try { svg = await readFile(svgPath, 'utf8'); }
  catch { throw new Error(`Missing diagram ${svgPath}. Run npm run diagrams.`); }
  if (!svg.startsWith(`<!-- source-sha256: ${digest} -->\n`)) {
    throw new Error(`Stale diagram ${svgPath}. Run npm run diagrams.`);
  }
  if (!svg.includes('<svg') || !svg.includes('</svg>')) throw new Error(`Invalid SVG in ${svgPath}.`);
}
console.log('Diagram hashes match their sources');
