import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://tathagata-ghosh-developer.github.io',
  integrations: [sitemap(), react()],
  build: { inlineStylesheets: 'always' },
});
