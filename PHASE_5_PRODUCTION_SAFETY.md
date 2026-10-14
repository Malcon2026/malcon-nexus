# Phase 5 — Production safety

## Read-only (safe on production PostgreSQL)

| Script / command | Writes production? |
|------------------|-------------------|
| `scripts/production-row-counts.sql` via `npx supabase db query --linked -f …` | **No** (SELECT) |
| `scripts/production-ddl-check.sql` via linked query | **No** |
| `scripts/run-production-readonly-checks.mjs` | **No** |
| `scripts/export-production-data.mjs` **without** `--execute` | **No** (dry-run) |
| `scripts/export-production-data.mjs --execute` | **No** (SELECT only; writes local files) |

## Local write (never production DB)

| Script / command | Target |
|------------------|--------|
| `worker/npm run db:migrate:local` | Local D1 only |
| `worker/npm run db:reset:local` | Local D1 state |
| `worker/npm run db:seed` | Local D1 |
| `scripts/import-d1-data.mjs` | **Local D1 only** (refuses `--remote`) |
| `scripts/test-synthetic-migration.mjs` | Local D1 |
| `scripts/generate-synthetic-jsonl.mjs` | Local fixture files |

## Never run without explicit approval

| Command | Risk |
|---------|------|
| `wrangler d1 … --remote` | Remote/production D1 |
| `wrangler d1 create` | Creates cloud D1 |
| `wrangler deploy` | Production Worker |
| `ALLOW_PRODUCTION_EXPORT=1 … export-production-data.mjs --execute` | Large read load on PG (still SELECT-only) |
| Any SQL containing INSERT/UPDATE/DELETE/TRUNCATE/ALTER/DROP on linked DB | Data/schema destruction |
| `supabase db reset` / push migrations to linked project | Production schema change |

## Production export approval gate

```bash
# Dry-run (default)
node scripts/export-production-data.mjs

# Actual export (read-only SELECT, local files only)
ALLOW_PRODUCTION_EXPORT=1 node scripts/export-production-data.mjs --execute
```

Optional: `--tables=cases,employees` and `--resume`.

## D1 isolation (future)

| Environment | Binding | Notes |
|-------------|---------|--------|
| Local dev | `database_id = "local"` in `wrangler.toml` | `.wrangler/state/v3/d1/` |
| Staging | `REPLACE_WITH_STAGING_D1_ID` | Separate Cloudflare D1 |
| Production | `REPLACE_WITH_PRODUCTION_D1_ID` | **Not created in Phase 5** |

Production SPA continues to use Supabase until a later cutover phase.
