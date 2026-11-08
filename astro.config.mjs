import { defineConfig } from 'astro/config';
import rehypeSources from './src/lib/rehype-sources.mjs';

export default defineConfig({ output: 'static', markdown: { rehypePlugins: [rehypeSources] } });
