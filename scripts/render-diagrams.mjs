import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// Mermaid embeds its edge-animation CSS in every SVG. An SVG shown through <img>
// follows the visitor's motion setting, so this rule stops every animation
// when the visitor asks for reduced motion.
const reducedMotion = '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none!important}}';

for (const file of (await readdir('src/content/diagrams')).filter(name => name.endsWith('.mmd'))) {
  const slug = file.slice(0, -4);
  const sourcePath = join('src/content/diagrams', file);
  const outputPath = join('public/diagrams', `${slug}.svg`);
  const result = spawnSync('npx', ['--yes', '--package=@mermaid-js/mermaid-cli@12.2.0', 'mmdc', '-i', sourcePath, '-o', outputPath, '--svgId', `lagom-${slug}`], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Failed to render ${sourcePath}`);
  const digest = createHash('sha256').update(await readFile(sourcePath)).digest('hex');
  const svg = await readFile(outputPath, 'utf8');
  if (!svg.includes('</style>')) throw new Error(`No <style> element in ${outputPath}`);
  const styled = svg.replace('</style>', () => `${reducedMotion}</style>`);
  await writeFile(outputPath, `<!-- source-sha256: ${digest} -->\n${styled}`);
}
console.log('Rendered diagrams');
