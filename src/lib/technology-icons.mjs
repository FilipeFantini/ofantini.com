// The technology logos in src/icons/, shared by the stack tags on the pages
// (src/components/TechStack.astro) and the diagrams (scripts/render-diagrams.mjs
// and scripts/check-diagrams.mjs), so both draw the same file the same way.

// The viewBox and inner markup of a logo file, without its comments, title or
// fixed size: the caller draws it at its own size and in its own colour.
export function iconParts(svg, file) {
  // Repeat until nothing changes, so a comment rebuilt by removing an inner one
  // cannot survive, then refuse anything that could still open markup or run
  // code: the files are ours, but the page inlines them as HTML.
  let clean = svg;
  for (let previous; previous !== clean; ) {
    previous = clean;
    clean = clean.replace(/<!--[\s\S]*?-->/g, '').replace(/<title>[^<]*<\/title>/g, '');
  }
  if (/<!--|-->|<script|<foreignObject|\son\w+\s*=|javascript:/i.test(clean)) {
    throw new Error(`Logo ${file} still holds a comment, a script or an event handler after cleaning`);
  }
  const open = /<svg\b([^>]*)>/.exec(clean);
  const viewBox = open && /\sviewBox="([^"]+)"/.exec(open[1])?.[1];
  const end = clean.lastIndexOf('</svg>');
  if (!viewBox || end < 0) throw new Error(`Logo ${file} has no <svg> with a viewBox`);
  return { viewBox, body: clean.slice(open.index + open[0].length, end).trim() };
}
