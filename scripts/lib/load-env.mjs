import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load `.env` from project root (and optional cwd). Later files override earlier keys. */
export function loadEnv() {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '..', '..', '.env'),
    resolve(__dirname, '..', '.env'),
  ];
  let loadedFrom = null;
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
    loadedFrom = envPath;
  }
  if (loadedFrom) process.env._MALCON_ENV_PATH = loadedFrom;
  return loadedFrom;
}
