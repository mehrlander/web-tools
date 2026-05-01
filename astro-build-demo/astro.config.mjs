import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://mehrlander.github.io',
  base: '/web-tools',
  // GitHub Pages serves from /docs at the root of the main branch. The Astro
  // project lives in this subdirectory, so we build one level up into the
  // repo's root /docs rather than the default ./dist.
  outDir: '../docs',
  integrations: [tailwind()],
});
