import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    proxy: {
      // dev proxy to the Axum backend
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
