#!/usr/bin/env node
/**
 * After creating a new Supabase project, print the checklist and validate CLI link.
 *
 *   node scripts/prepare-new-supabase-project.mjs <new-project-ref>
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const newRef = process.argv[2];

if (!newRef || !/^[a-z0-9]{20}$/.test(newRef)) {
  console.error('Usage: node scripts/prepare-new-supabase-project.mjs <new-project-ref>');
  process.exit(1);
}

const linkedPath = resolve(root, 'supabase/.temp/project-ref');
const oldRef = existsSync(linkedPath) ? readFileSync(linkedPath, 'utf8').trim() : '(none)';

console.log(`
=== Malcon Nexus — new Supabase project ===

New project ref: ${newRef}
Previously linked: ${oldRef}

1) Link CLI (run from repo root):
   npx supabase link --project-ref ${newRef} --yes

2) Apply schema (Dashboard → SQL Editor, in order):
   - supabase/schema.sql (if present / baseline)
   - Each file in supabase/migrations/*.sql (by date/name order)
   Or paste from your backup: backups/migration-*/public-schema.sql + public-data.sql

3) Storage buckets (Dashboard → Storage):
   - stage-photos (public or signed URLs per existing RLS)
   - attendance-selfies (match supabase/migrations/add-attendance-selfie.sql)

4) Edge Function secrets — copy from old project notes / Hostinger deploy:
   RESEND_*, TELEGRAM_*, TV_BOARD_TOKEN, GALLERY_TOKEN, VAPID_*, etc.

5) Deploy all functions:
   npx supabase functions deploy --project-ref ${newRef}

6) Local .env (never commit):
   VITE_SUPABASE_URL=https://${newRef}.supabase.co
   VITE_SUPABASE_ANON_KEY=<from: npx supabase projects api-keys --project-ref ${newRef}>
   SUPABASE_SERVICE_ROLE_KEY=<service_role from same command>

7) If old project unlocks, export data FIRST:
   node scripts/export-supabase-backup.mjs
   (Install Docker Desktop for full pg_dump via: npx supabase db dump -f backups/.../full.sql --project-ref OLD_REF)

8) Production:
   npm run build && npm run deploy:hostinger

9) Rotate API keys on the OLD project after cutover (keys were used during emergency export).
`);

try {
  execSync('npx supabase projects list -o json', { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  console.log('Supabase CLI: logged in (projects list OK).\n');
} catch {
  console.log('Supabase CLI: run `npx supabase login` if projects list fails.\n');
}
