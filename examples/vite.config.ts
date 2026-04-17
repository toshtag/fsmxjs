import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/fsmxjs/' : '/',
  resolve: {
    alias: {
      fsmxjs: path.resolve(__dirname, '../src/index.ts'),
      '@fsmxjs/async': path.resolve(__dirname, '../packages/async/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        toggle: path.resolve(__dirname, 'toggle/index.html'),
        'form-wizard': path.resolve(__dirname, 'form-wizard/index.html'),
        'queue-mode': path.resolve(__dirname, 'queue-mode/index.html'),
        serialization: path.resolve(__dirname, 'serialization/index.html'),
        'async-search': path.resolve(__dirname, 'async-search/index.html'),
      },
    },
  },
});
