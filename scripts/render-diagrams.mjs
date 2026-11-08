import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

for (const file of (await readdir('src/content/diagrams')).filter(name => name.endsWith('.mmd'))) {
  const slug = file.slice(0, -4);
  const sourcePath = join('src/content/diagrams', file);
  const outputPath = join('public/diagrams', `${slug}.svg`);
  const result = spawnSync('npx', ['--yes', '--package=@mermaid-js/mermaid-cli@12.2.0', 'mmdc', '-i', sourcePath, '-o', outputPath, '--svgId', `lagom-${slug}`], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Failed to render ${sourcePath}`);
  const digest = createHash('sha256').update(await readFile(sourcePath)).digest('hex');
  const svg = await readFile(outputPath, 'utf8');
  await writeFile(outputPath, `<!-- source-sha256: ${digest} -->\n${svg}`);
}
console.log('Rendered diagrams');
