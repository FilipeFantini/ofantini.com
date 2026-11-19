// The technology logos in src/icons/, shared by the stack tags on the pages
// (src/components/TechStack.astro) and the diagrams (scripts/render-diagrams.mjs
// and scripts/check-diagrams.mjs), so both draw the same file the same way.

// The viewBox and inner markup of a logo file, without its comments, title or
// fixed size: the caller draws it at its own size and in its own colour.
export function iconParts(svg, file) {
  const clean = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<title>[^<]*<\/title>/, '');
  const open = /<svg\b([^>]*)>/.exec(clean);
  const viewBox = open && /\sviewBox="([^"]+)"/.exec(open[1])?.[1];
  const end = clean.lastIndexOf('</svg>');
  if (!viewBox || end < 0) throw new Error(`Logo ${file} has no <svg> with a viewBox`);
  return { viewBox, body: clean.slice(open.index + open[0].length, end).trim() };
}
