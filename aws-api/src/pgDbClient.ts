import { drizzle } from 'drizzle-orm/node-postgres';
import * as pgSchema from '../../worker/src/db/schema.pg.ts';
import type { Env } from '../../worker/src/env.ts';

export type Db = ReturnType<typeof createDb>;

export function usesPostgres(_env: Env): boolean {
  return true;
}

export function createDb(env: Env) {
  if (!env.pgPool) {
    throw new Error('pgPool is required for AWS API');
  }
  return drizzle(env.pgPool, { schema: pgSchema });
}
