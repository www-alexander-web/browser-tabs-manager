import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        manager: path.resolve(__dirname, 'pages/manager/index.html'),
        options: path.resolve(__dirname, 'pages/options/index.html'),
        'background/service-worker': path.resolve(__dirname, 'src/background/service-worker.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep deterministic paths for extension scripts.
          // - background/service-worker.ts -> background/service-worker.js
          // - page entrypoints -> assets/<name>.js
          if (chunkInfo.name.startsWith('background/')) return '[name].js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});
