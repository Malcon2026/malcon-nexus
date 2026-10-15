#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerSrc = resolve(__dirname, '../worker/src');

const awsAliasesPlugin = {
  name: 'aws-aliases',
  setup(build) {
    build.onResolve({ filter: /\/db\/schema\.ts$/ }, (args) => {
      if (args.importer.includes('schema.pg.ts')) return null;
      return { path: resolve(workerSrc, 'db/schema.pg.ts') };
    });
    build.onResolve({ filter: /\/db\/client\.ts$/ }, (args) => {
      if (args.importer.includes('pgDbClient.ts')) return null;
      return { path: resolve(__dirname, 'src/pgDbClient.ts') };
    });
  },
};

mkdirSync(resolve(__dirname, 'dist'), { recursive: true });

await esbuild.build({
  entryPoints: [resolve(__dirname, 'src/server.ts')],
  outfile: resolve(__dirname, 'dist/server.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  external: ['pg', 'pg-native'],
  plugins: [awsAliasesPlugin],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

console.info('Built aws-api/dist/server.js');
