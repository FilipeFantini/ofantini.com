import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { articleHeadingIds, articleSources } from './src/lib/article-markdown.mjs';

export default defineConfig({
  output: 'static',
  markdown: { processor: satteri({ hastPlugins: [articleHeadingIds, articleSources] }) },
});
