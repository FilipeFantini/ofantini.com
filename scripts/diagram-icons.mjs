import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { iconParts } from '../src/lib/technology-icons.mjs';

// A diagram may show a technology's logo beside a node that names it. The
// source asks for it with a Mermaid comment, which Mermaid itself ignores:
//
//   %% icon <node id> <technology id>
//
// The technology comes from src/data/technologies.json and its logo from
// src/icons/, so a diagram draws the same file as the stack tags. The digest
// that marks an SVG as current covers the source and every logo it uses, so a
// changed logo makes the diagram stale too. A source without icons keeps the
// digest of its bytes alone.
export async function readDiagram(sourcePath, technologyFile = 'src/data/technologies.json', iconDir = 'src/icons') {
  const source = await readFile(sourcePath);
  const hash = createHash('sha256').update(source);
  const icons = [];
  let technologies;
  for (const line of source.toString('utf8').split('\n').filter(line => /^\s*%%\s*icon\b/.test(line))) {
    const match = /^\s*%%\s*icon\s+([A-Za-z0-9_]+)\s+([a-z][a-z0-9-]*)\s*$/.exec(line);
    if (!match) throw new Error(`Diagram ${sourcePath} has an icon line that is not "%% icon <node> <technology>": ${line.trim()}`);
    const [, node, technology] = match;
    if (icons.some(icon => icon.node === node)) throw new Error(`Diagram ${sourcePath} gives node ${node} more than one icon`);
    technologies ??= JSON.parse(await readFile(technologyFile, 'utf8'));
    const icon = technologies[technology]?.icon;
    if (!icon) throw new Error(`Diagram ${sourcePath} names technology ${technology}, which is unknown or has no icon`);
    const file = await readFile(join(iconDir, `${icon}.svg`));
    hash.update(file);
    icons.push({ node, technology, ...iconParts(file.toString('utf8'), icon) });
  }
  return { digest: hash.digest('hex'), icons };
}

const ink = '#20352f';
const paper = '#f8f1dd';
const radius = 15;
const number = '(-?[0-9.]+)';

// Draws each logo as a small badge on the top-left corner of its node, in the
// diagram's ink colour, and widens the drawing so a badge on an edge node is
// not cut off. The badges sit in their own group after the nodes, so Mermaid's
// node styles do not repaint them. Only rectangles and cylinders are placed;
// any other node shape fails loudly instead of guessing.
export function addIcons(svg, slug, icons) {
  if (icons.length === 0) return svg;
  const badges = icons.map(({ node, viewBox, body }) => {
    const group = new RegExp(`<g class="node[^"]*" id="lagom-${slug}-flowchart-${node}-\\d+"[^>]*transform="translate\\(${number}, ?${number}\\)">`).exec(svg);
    if (!group) throw new Error(`Diagram ${slug} has no flowchart node ${node} for its icon`);
    const after = svg.slice(group.index + group[0].length);
    const rect = new RegExp(`^<rect class="basic label-container"[^>]* x="${number}" y="${number}"`).exec(after);
    const cylinder = new RegExp(`^<path d="M0,${number} a[^"]*"[^>]* transform="translate\\(${number}, ?${number}\\)"`).exec(after);
    let corner;
    if (rect) corner = [Number(rect[1]), Number(rect[2])];
    else if (cylinder) corner = [Number(cylinder[2]), Number(cylinder[3]) + Number(cylinder[1])];
    else throw new Error(`Diagram ${slug}: node ${node} is not a rectangle or a cylinder`);
    const x = Number(group[1]) + corner[0];
    const y = Number(group[2]) + corner[1];
    return `<g class="tech-icon" transform="translate(${x}, ${y})"><circle r="${radius}" style="fill:${paper};stroke:${ink};stroke-width:1px"/><svg x="-10" y="-10" width="20" height="20" viewBox="${viewBox}" style="fill:${ink}">${body}</svg></g>`;
  });
  const root = /<svg id="lagom-[^"]*"[^>]*>/.exec(svg);
  // The badges use the node coordinates as they are, which holds while the
  // nodes sit in an untransformed root group (a flowchart without subgraphs).
  if (!svg.includes('<g class="root"><g class="clusters"/>') || /<g class="root"[^>]*transform/.test(svg) || svg.includes('class="cluster ')) {
    throw new Error(`Diagram ${slug} does not have the plain root group the icon badges assume`);
  }
  const viewBox = /viewBox="([^"]+)"/.exec(root[0])[1].split(/\s+/).map(Number);
  const pad = radius + 2;
  const widened = root[0]
    .replace(/viewBox="[^"]+"/, `viewBox="${viewBox[0] - pad} ${viewBox[1] - pad} ${viewBox[2] + 2 * pad} ${viewBox[3] + 2 * pad}"`)
    .replace(/max-width: ([0-9.]+)px/, (_, width) => `max-width: ${Number(width) + 2 * pad}px`);
  const end = svg.lastIndexOf('</svg>');
  return svg.slice(0, root.index) + widened + svg.slice(root.index + root[0].length, end) + `<g class="tech-icons">${badges.join('')}</g>` + svg.slice(end);
}
