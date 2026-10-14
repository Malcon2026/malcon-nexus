# Phase 5 — Schema completion & migration tooling

**Date:** 2026-10-14  
**Production data export:** Not executed  
**Remote D1:** Not touched  

---

## 1. HR/TMS schema completion

Replaced 7 placeholder tables in `worker/src/db/schema.ts` with production-aligned definitions from `backups/production-checks-2026-10-14/production-ddl-full.txt`.

**Migration:** `worker/drizzle/migrations/0001_hr_tms_production_schema.sql` (drops placeholder tables, creates full HR/TMS schema with FKs and indexes).

Historical `0000_famous_daimon_hellstrom.sql` unchanged.

---

## 2. Schema diff

See [`PHASE_5_SCHEMA_DIFF.md`](PHASE_5_SCHEMA_DIFF.md).

---

## 3. Local migration tests

| Command | Result |
|---------|--------|
| `npm run db:reset:local` | Pass (0000 + 0001) |
| `npm run db:validate` | Pass (63 indexes, HR/TMS `code` column) |
| `npm run db:test` | Pass |
| `npm run migration:test:synthetic` | **PASS** |

---

## 4. Export tooling

**Script:** [`scripts/export-production-data.mjs`](scripts/export-production-data.mjs)

- Linked Supabase **SELECT only**
- JSONL per table, batched (`EXPORT_BATCH_SIZE`, default 200)
- Default: **dry-run**
- Execute: `ALLOW_PRODUCTION_EXPORT=1 node scripts/export-production-data.mjs --execute`
- **Not run in Phase 5**

---

## 5. Import tooling

**Script:** [`scripts/import-d1-data.mjs`](scripts/import-d1-data.mjs)

- **Local D1 only** (`worker/scripts/exec-local-d1.mjs`)
- Reads `*.jsonl` + optional `manifest.json`
- FK order: [`scripts/migration/table-order.mjs`](scripts/migration/table-order.mjs)
- Transforms: [`scripts/migration/transforms.mjs`](scripts/migration/transforms.mjs) (money → minor, JSON, booleans)
- `PRAGMA foreign_key_check` after import

---

## 6. Synthetic migration test

| Artifact | Path |
|----------|------|
| Generator | `scripts/generate-synthetic-jsonl.mjs` |
| Fixture | `worker/fixtures/synthetic-migration/*.jsonl` |
| Test runner | `scripts/test-synthetic-migration.mjs` |

Verified: row counts, FK (onboarding→kyc), `cases.stages` JSON, `invoice_amount_minor` 125050.

---

## 7. Documentation

| Doc | Purpose |
|-----|---------|
| [`PHASE_5_MIGRATION_ORDER.md`](PHASE_5_MIGRATION_ORDER.md) | FK-safe import order |
| [`PHASE_5_PRODUCTION_SAFETY.md`](PHASE_5_PRODUCTION_SAFETY.md) | Read-only vs local vs forbidden |

---

## 8. Remaining blockers (before production import)

| Item | Status |
|------|--------|
| D1 schema for 30 public tables | **Done** locally |
| Export/import tooling | **Done** (not run on production) |
| Full production JSONL export | **Pending** — `ALLOW_PRODUCTION_EXPORT=1 … --execute` |
| Staging D1 + `--remote` apply | **Future phase** (explicitly out of Phase 5) |
| Worker API + auth for HR/TMS RLS | **Future phase** |
| Storage / R2 (`hr-kyc-uploads`, stage-photos) | **Future phase** |
| Optional `idx_petrol_book_token` on D1 | **Optional** |

---

## 9. Exact next step (Phase 6 — not started)

1. Create **staging** D1 in Cloudflare (when approved).  
2. Run production export to `backups/production-export-YYYY-MM-DD/`.  
3. Apply migrations to **staging** D1 (`--remote` with staging id only).  
4. Import JSONL; validate counts against `production-row-counts-full.txt`.  
5. Do **not** connect SPA until Worker API phase.

---

## Commands reference

```bash
# Local schema + tests
cd worker
npm run db:reset:local
npm run db:validate
npm run db:test
npm run migration:test:synthetic

# Production export (when approved)
node scripts/export-production-data.mjs
ALLOW_PRODUCTION_EXPORT=1 node scripts/export-production-data.mjs --execute

# Local import
node scripts/import-d1-data.mjs --dir worker/fixtures/synthetic-migration --source synthetic
```

---

PHASE 5 COMPLETE: YES

LOCAL MIGRATION TEST: PASS

PRODUCTION DATA TOUCHED: NO

REMOTE D1 TOUCHED: NO

READY FOR PHASE 6: YES

*(Tooling and local schema complete; Phase 6 is staging export/import — not started.)*
