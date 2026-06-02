import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://mehrlander.github.io',
  base: '/web-tools/pages/astro-build-demo',
  outDir: '../pages/astro-build-demo',
  integrations: [tailwind()],
});
