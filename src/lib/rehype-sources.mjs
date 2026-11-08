// Marks a paragraph made only of source links ("[Source: ...](...)", joined
// by " · ") with class="sources", so the article styles it as a quiet
// citation line instead of body text. Runs on the HTML tree of every Markdown
// article (astro.config.mjs). A paragraph with any other content is left alone.

const isSourceLink = node =>
  node.type === 'element' &&
  node.tagName === 'a' &&
  node.children.length > 0 &&
  node.children[0].type === 'text' &&
  node.children[0].value.startsWith('Source');

const isSeparator = node => node.type === 'text' && /^[\s·]*$/.test(node.value);

function mark(node) {
  if (node.type === 'element' && node.tagName === 'p') {
    const links = node.children.filter(isSourceLink);
    if (links.length > 0 && node.children.every(child => isSourceLink(child) || isSeparator(child))) {
      node.properties = { ...node.properties, className: ['sources'] };
    }
    return;
  }
  for (const child of node.children ?? []) mark(child);
}

export default function rehypeSources() {
  return tree => mark(tree);
}
