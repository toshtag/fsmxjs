import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      fsmxjs: path.resolve(__dirname, '../../src/index.ts'),
    },
  },
  test: {
    root: path.resolve(__dirname, '.'),
    include: ['tests/**/*.test.ts'],
    typecheck: {
      include: ['tests/**/*.test-d.ts'],
    },
  },
});
