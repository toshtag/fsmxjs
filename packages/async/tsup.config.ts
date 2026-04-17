import path from 'path';
import { defineConfig } from 'tsup';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  entry: [path.join(__dirname, 'src/index.ts')],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  outDir: path.join(__dirname, 'dist'),
  external: ['fsmxjs'],
});
