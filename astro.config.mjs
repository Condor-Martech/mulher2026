// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  base: '/',
  trailingSlash: 'always',
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  redirects: {
    '/': 'https://www.condor.com.br',
  },
  vite: {
    plugins: [tailwindcss()]
  },
  server: {
    allowedHosts: [
      'eaf7-200-150-68-28.ngrok-free.app'
    ]
  },

  integrations: [react()]
});