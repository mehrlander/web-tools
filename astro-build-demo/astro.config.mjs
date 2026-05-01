import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://mehrlander.github.io',
  base: '/astro-build-demo',
  // GitHub Pages serves from /docs on the main branch, so we build there
  // instead of the default ./dist.
  outDir: './docs',
  integrations: [tailwind()],
});
