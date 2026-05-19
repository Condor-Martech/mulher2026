// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

const isVercel = typeof process !== 'undefined' && !!process.env.VERCEL;

// https://astro.build/config
export default defineConfig({
  base: '/',
  trailingSlash: 'always',
  output: 'server',
  adapter: isVercel ? vercel() : node({ mode: 'standalone' }),
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