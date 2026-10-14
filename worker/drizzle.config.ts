import { defineConfig } from 'drizzle-kit';

/**
 * D1 migrations are applied via Wrangler (`wrangler d1 migrations apply`).
 * This config is for generating SQL from `src/db/schema.ts` only.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
});
