// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  base: '/',
  trailingSlash: 'always',
  redirects: {
    '/': 'https://www.condor.com.br',
  },
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react()]
});