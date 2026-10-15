import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import type { Env } from '../env';

export type Db = ReturnType<typeof createDb>;

export function usesPostgres(env: Env): boolean {
  return Boolean(env.pgPool);
}

/** Drizzle client bound to D1 (Cloudflare Worker). AWS uses aliased `client.pg.ts` in aws-api bundle. */
export function createDb(env: Env) {
  if (env.pgPool) {
    throw new Error('PostgreSQL pgPool is not supported in the Cloudflare Worker bundle');
  }
  if (!env.DB) {
    throw new Error('Database is not configured (missing D1 DB binding)');
  }
  return drizzle(env.DB, { schema });
}
