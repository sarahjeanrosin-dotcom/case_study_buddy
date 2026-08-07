import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: {
    // Inline (empty) PostCSS config so Vite doesn't search parent directories
    // for a postcss.config.js — on this machine that search was reaching
    // C:\Users\SarahRosin\postcss.config.js (an unrelated tailwind config
    // for a different project) and crashing the dev server / build.
    postcss: {},
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
