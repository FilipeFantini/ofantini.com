// Two hast plugins for Sätteri, Astro's Markdown processor, applied to the
// articles in src/content/articles/ (astro.config.mjs). Other Markdown is
// left alone.
//
// articleHeadingIds: every heading gets an id prefixed with the article's
// track and slug ("security-agents--gotchas"). Articles share their section
// headings ("What we built", "Gotchas") and the desktop can show several
// articles in one page, so plain ids would repeat. Astro's own heading-id
// pass runs after user plugins and keeps an id that is already set.
//
// articleSources: a paragraph made only of "[Source: ...](...)" links joined
// by " · " gets class="sources", styled as a quiet citation line.
import { fileURLToPath } from 'node:url';

function articleOf(fileURL) {
  if (!fileURL) return null;
  const match = /src\/content\/articles\/([^/]+)\/([^/]+)\.md$/.exec(fileURLToPath(fileURL));
  return match ? `${match[1]}-${match[2]}` : null;
}

const slug = value =>
  value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function articleHeadingIds(factory) {
  const prefix = articleOf(factory.fileURL);
  if (!prefix) return null;
  const seen = new Map();
  return {
    name: 'article-heading-ids',
    element: {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      visit(node, ctx) {
        const base = `${prefix}--${slug(ctx.textContent(node)) || 'section'}`;
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        ctx.setProperty(node, 'id', count ? `${base}-${count}` : base);
      },
    },
  };
}

const isSourceLink = node =>
  node.type === 'element' && node.tagName === 'a' &&
  node.children?.[0]?.type === 'text' && node.children[0].value.startsWith('Source');
const isSeparator = node => node.type === 'text' && /^[\s·]*$/.test(node.value);

export function articleSources(factory) {
  if (!articleOf(factory.fileURL)) return null;
  return {
    name: 'article-sources',
    element: {
      filter: ['p'],
      visit(node, ctx) {
        const children = node.children ?? [];
        if (children.some(isSourceLink) && children.every(child => isSourceLink(child) || isSeparator(child))) {
          ctx.setProperty(node, 'className', ['sources']);
        }
      },
    },
  };
}
