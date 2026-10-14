# Malcon Nexus — Cloudflare Worker + D1 (foundation)

This directory is the **future backend** for Malcon Nexus. It does **not** replace Supabase yet.

## Current production path (unchanged)

```text
Browser (Vite SPA on Hostinger) → Supabase PostgREST + Auth + Storage + Edge Functions
```

## Target path (after cutover)

```text
Browser → Cloudflare Worker (Hono router) → Drizzle ORM → D1
                                      ↘ R2 (photos, Phase 10+)
```

## Layout

| Path | Purpose |
|------|---------|
| `src/index.ts` | Worker entry (`/health`, dev `/health/db`; other routes 501) |
| `src/db/schema.ts` | Drizzle schema mapped from PostgreSQL |
| `src/db/client.ts` | `drizzle(env.DB)` factory |
| `src/middleware/auth.ts` | Auth identity interfaces (Supabase JWT bridge later) |
| `src/middleware/authorization.ts` | RLS replacement helpers |
| `src/routes/*` | Future REST handlers (stubs) |
| `src/services/*` | RPC replacements (stubs) |
| `wrangler.toml` | dev / staging / production bindings |
| `drizzle.config.ts` | SQL migration generation |
| `drizzle/migrations/` | Applied SQL migrations |
| `scripts/` | Local D1 validate, seed, test, SQL helper |

Full design: [`../PHASE_2_D1_ARCHITECTURE.md`](../PHASE_2_D1_ARCHITECTURE.md)  
Phase 3 report: [`../PHASE_3_LOCAL_D1.md`](../PHASE_3_LOCAL_D1.md)

---

## Phase 3 — local D1 only

All commands below use **local** D1 (`database_id = "local"`). Do **not** add `--remote` until a later phase.

### Install

```bash
cd worker
npm install
```

### Create / reset local database

Wrangler creates local D1 state on first use. For a clean slate:

```bash
npm run db:reset:local
```

This removes `worker/.wrangler/state/v3/d1`, reapplies migrations, and seeds fictional data.

### Generate migrations (after editing `src/db/schema.ts`)

```bash
npm run db:generate
```

Output: `drizzle/migrations/*.sql`

Review generated SQL (FKs, indexes, NOT NULL) before applying.

### Apply migrations locally

```bash
npm run db:migrate:local
```

Equivalent: `wrangler d1 migrations apply malcon-nexus-dev --local`

### Seed development data

Fictional dataset only — no production copy.

```bash
npm run db:seed
```

### Validate schema

```bash
npm run db:validate
```

Checks tables, placeholders, PKs, sample FKs/indexes, NOT NULL / unique constraints.

### Integration tests (JSON, money, FK, CRUD, egress-safe SQL)

```bash
npm run db:test
npm run migration:test:synthetic
```

### Migration tooling (Phase 5 — repo root)

| Script | Role |
|--------|------|
| `../scripts/export-production-data.mjs` | Read-only PG → JSONL (dry-run default) |
| `../scripts/import-d1-data.mjs` | JSONL → **local** D1 only |
| `../scripts/generate-synthetic-jsonl.mjs` | Fictional fixture |
| `../scripts/test-synthetic-migration.mjs` | End-to-end local import test |

See [`../PHASE_5_SCHEMA_AND_TOOLING.md`](../PHASE_5_SCHEMA_AND_TOOLING.md).

Uses `wrangler d1 execute ... --local` only.

### Start local Worker

```bash
npm run dev
```

```bash
curl -s http://localhost:8787/health
curl -s http://localhost:8787/health/db   # development only; employee count from D1
```

### Database inspection (local)

```bash
npx wrangler d1 execute malcon-nexus-dev --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
npx wrangler d1 execute malcon-nexus-dev --local --command "PRAGMA foreign_key_list(cases);"
npx wrangler d1 execute malcon-nexus-dev --local --command "SELECT COUNT(*) AS c FROM employees;"
```

Helper scripts normalize SQL to a single line (Wrangler `--command` does not accept leading newlines).

### Money fields

Store currency as **integer minor units** (paise): ₹1250.50 → `125050`.

Columns: `invoice_amount_minor`, `collected_amount_minor`, `petrol_requests.amount_minor`. Daily expenses use PG-aligned `kms_driven` / `petrol_amount` / `food_amount` / `other_amount` (REAL), not minor units.

---

## Configuration notes

| Item | Value |
|------|--------|
| Dev D1 binding | `env.DB` → `malcon-nexus-dev` |
| Dev database id | `local` in `wrangler.toml` |
| Migrations dir | `drizzle/migrations` |
| Staging/prod D1 ids | `REPLACE_WITH_*_D1_ID` — set in Cloudflare when creating remote DBs (not Phase 3) |

Secrets: copy `.dev.vars.example` → `.dev.vars` (gitignored) when auth/secrets are added in later phases.

---

## Environments (reference — not Phase 3 steps)

| Env | Worker name | D1 binding | SPA origin (CORS) |
|-----|-------------|------------|-------------------|
| development | `malcon-nexus-api` | local D1 | `http://localhost:5173` |
| staging | `malcon-nexus-api-staging` | staging D1 id in `wrangler.toml` | staging Hostinger URL |
| production | `malcon-nexus-api` | production D1 id | `https://app.malconnexus.com` |

Deploy scripts exist (`deploy:staging`, `deploy:production`) but are **out of scope** for Phase 3 local D1 work.

---

## Important

- Do **not** point the SPA at this API until a later phase (feature flag).
- Do **not** delete or modify Supabase migrations in `/supabase`.
- HR/TMS tables in schema are **placeholders** until production DDL is exported.
