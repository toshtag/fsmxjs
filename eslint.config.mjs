// @ts-check
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: tseslint.configs.recommended,
  },
  {
    ignores: ['dist/**', 'docs/**', 'node_modules/**'],
  },
]);
