import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // Dev server: proxy /api → backend :4000 (tránh CORS khi dev)
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },

  // Production build: output vào dist/ (backend sẽ serve từ đây)
  build: {
    outDir: '../backend/dist',
    emptyOutDir: true,
  },
});
