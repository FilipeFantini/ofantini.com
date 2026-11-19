import { readdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { addIcons, readDiagram } from './diagram-icons.mjs';

// Mermaid embeds its edge-animation CSS in every SVG. An SVG shown through <img>
// follows the visitor's motion setting, so this rule stops every animation
// when the visitor asks for reduced motion.
// scripts/mermaid.json sets the font to arial, sans-serif. Mermaid CLI embeds the
// default font (about 200 KB) into an SVG, and an SVG shown through <img> gets no
// page fonts, so text is measured with a font every browser has instead.
const reducedMotion = '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important}}';

// With names (`npm run diagrams -- etl-usgs-pipeline`), only those diagrams are
// rendered again; without, all of them.
const only = process.argv.slice(2);
for (const file of (await readdir('src/content/diagrams')).filter(name => name.endsWith('.mmd') && (only.length === 0 || only.includes(name.slice(0, -4))))) {
  const slug = file.slice(0, -4);
  const sourcePath = join('src/content/diagrams', file);
  const outputPath = join('public/diagrams', `${slug}.svg`);
  const result = spawnSync('npx', ['--yes', '--package=@mermaid-js/mermaid-cli@12.2.0', 'mmdc', '-i', sourcePath, '-o', outputPath, '-c', 'scripts/mermaid.json', '-b', 'transparent', '--svgId', `lagom-${slug}`], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Failed to render ${sourcePath}`);
  const { digest, icons } = await readDiagram(sourcePath);
  const svg = await readFile(outputPath, 'utf8');
  if (!svg.includes('</style>')) throw new Error(`No <style> element in ${outputPath}`);
  const styled = addIcons(svg.replace('</style>', () => `${reducedMotion}</style>`), slug, icons);
  await writeFile(outputPath, `<!-- source-sha256: ${digest} -->\n${styled}`);
}
console.log('Rendered diagrams');
