#!/usr/bin/env node
/**
 * Generate worker/src/db/schema.pg.ts from schema.ts (D1/SQLite → PostgreSQL Drizzle).
 * Run after editing schema.ts: node scripts/generate-pg-drizzle-schema.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'worker/src/db/schema.ts'), 'utf8');

let out = src
  .replace(
    /\/\*\*[\s\S]*?Cloudflare D1 \(SQLite\)[\s\S]*?\*\//,
    `/**
 * PostgreSQL (RDS) schema — generated from schema.ts for AWS API runtime.
 * Regenerate: node scripts/generate-pg-drizzle-schema.mjs
 */`,
  )
  .replace(
    "import {\n  sqliteTable,\n  text,\n  integer,\n  real,\n  index,\n  uniqueIndex,\n} from 'drizzle-orm/sqlite-core';",
    "import {\n  pgTable,\n  text,\n  integer,\n  real,\n  boolean,\n  index,\n  uniqueIndex,\n} from 'drizzle-orm/pg-core';",
  )
  .replace(/\bsqliteTable\b/g, 'pgTable')
  .replace(/integer\('([^']+)', \{ mode: 'boolean' \}\)/g, "boolean('$1')");

writeFileSync(resolve(root, 'worker/src/db/schema.pg.ts'), out);
console.info('Wrote worker/src/db/schema.pg.ts');
