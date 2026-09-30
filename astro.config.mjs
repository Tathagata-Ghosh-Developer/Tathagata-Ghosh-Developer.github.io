import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tathagata-ghosh-developer.github.io',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'always' },
});
