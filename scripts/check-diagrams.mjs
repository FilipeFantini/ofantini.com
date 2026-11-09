import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Mermaid's SVG carries edge-animation CSS; render-diagrams.mjs adds this rule.
const stopsAnimation = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^{}]*\{[^{}]*animation:\s*none\s*!important/;
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
  if (svg.includes('animation:') && !stopsAnimation.test(svg)) {
    throw new Error(`Animated diagram ${svgPath} has no reduced-motion rule. Run npm run diagrams.`);
  }
}
console.log('Diagram hashes match their sources and animated diagrams respect reduced motion');
