import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['packages/async/src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: false,
  sourcemap: true,
  target: 'node18',
  outDir: 'packages/async/dist',
  external: ['fsmxjs'],
  tsconfig: 'packages/async/tsconfig.json',
});
