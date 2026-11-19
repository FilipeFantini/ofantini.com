// The technology logos in src/icons/, shared by the stack tags on the pages
// (src/components/TechStack.astro) and the diagrams (scripts/render-diagrams.mjs
// and scripts/check-diagrams.mjs), so both draw the same file the same way.

// HTML comments removed by scanning, not by a regular expression: everything
// from `<!--` to the first `-->` or `--!>` goes, an unclosed comment is refused,
// and the scan repeats until nothing changes, so a comment rebuilt by removing
// an inner one cannot survive.
function withoutComments(svg, file) {
  let text = svg;
  for (let previous; previous !== text; ) {
    previous = text;
    let out = '';
    let at = 0;
    for (;;) {
      const open = text.indexOf('<!--', at);
      if (open < 0) break;
      const ends = [text.indexOf('-->', open + 4), text.indexOf('--!>', open + 4)].filter(i => i >= 0);
      if (ends.length === 0) throw new Error(`Logo ${file} has an unclosed comment`);
      const end = Math.min(...ends);
      out += text.slice(at, open);
      at = end + (text.startsWith('-->', end) ? 3 : 4);
    }
    text = out + text.slice(at);
  }
  return text;
}

// The viewBox and inner markup of a logo file, without its comments, title or
// fixed size: the caller draws it at its own size and in its own colour. The
// files are ours, but the page inlines them as HTML, so anything that could
// still open markup or run code fails the build.
export function iconParts(svg, file) {
  const clean = withoutComments(svg, file).replace(/<title>[^<]*<\/title>/g, '');
  const lower = clean.toLowerCase();
  if (['<!--', '-->', '--!>', '<script', '<foreignobject', 'javascript:'].some(s => lower.includes(s)) || /\son[a-z]+\s*=/.test(lower)) {
    throw new Error(`Logo ${file} still holds a comment, a script or an event handler after cleaning`);
  }
  const open = /<svg\b([^>]*)>/.exec(clean);
  const viewBox = open && /\sviewBox="([^"]+)"/.exec(open[1])?.[1];
  const end = clean.lastIndexOf('</svg>');
  if (!viewBox || end < 0) throw new Error(`Logo ${file} has no <svg> with a viewBox`);
  return { viewBox, body: clean.slice(open.index + open[0].length, end).trim() };
}
