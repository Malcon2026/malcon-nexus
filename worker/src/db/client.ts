import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import type { Env } from '../env';

export type Db = ReturnType<typeof createDb>;

/** Drizzle client bound to the D1 database. Not used by the Hostinger SPA yet. */
export function createDb(env: Env) {
  return drizzle(env.DB, { schema });
}
