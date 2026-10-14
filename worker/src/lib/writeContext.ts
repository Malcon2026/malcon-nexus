import type { Env } from '../env';

export function writeRelaxed(env: Env): boolean {
  return env.ENVIRONMENT === 'development' && env.API_REQUIRE_AUTH !== '1';
}

export function nowIso(): string {
  return new Date().toISOString();
}
