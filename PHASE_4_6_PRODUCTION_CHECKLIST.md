# Phase 4.6 — Production read-only checks (you run these)

**Purpose:** Collect the two remaining prerequisites before Phase 5 data migration:

1. **Production row counts** (and sizes) for all public tables  
2. **Production DDL metadata** for the **7 HR/TMS tables**

**This phase does not run anything automatically.** No agent, CI, or script in this repo should execute these against production without your explicit action.

---

## What you must NOT run

Do **not** run any of the following against production during this checklist:

| Forbidden | Why |
|-----------|-----|
| `INSERT` / `UPDATE` / `DELETE` / `TRUNCATE` / `DROP` / `ALTER` | Modifies production |
| `supabase db reset`, `supabase migration repair`, applying new SQL migrations | Modifies production schema |
| `scripts/export-supabase-backup.mjs` (unless you intentionally want a data export later) | Not required for 4.6; pulls full row data |
| `wrangler d1 … --remote`, production D1 create/import | Phase 5+ |
| Changing `src/`, Supabase migrations, or `worker/src/db/schema.ts` | Out of scope |
| Rotating keys or deleting Supabase project | Irreversible |

**Allowed:** `SELECT` and catalog reads only (the two SQL files below).

---

## Prerequisites

1. **Supabase CLI** installed and logged in (`npx supabase login`).
2. **Project linked** to your live Malcon Nexus project (one time):

   ```bash
   cd /path/to/malcon-nexus
   npx supabase link --project-ref <YOUR_PROJECT_REF>
   ```

   Project ref is in Supabase Dashboard → Project Settings → General.

3. **Alternative:** Supabase Dashboard → **SQL Editor** (same PostgreSQL; paste SQL manually).

4. **Egress note:** These scripts use the database SQL path (`supabase db query --linked`), not PostgREST. That is appropriate when REST is limited.

---

## Check A — Row counts and sizes

### Script

[`scripts/production-row-counts.sql`](scripts/production-row-counts.sql)

### Where to run

**Option 1 — CLI (recommended):**

```bash
cd /path/to/malcon-nexus
npx supabase db query --linked -f scripts/production-row-counts.sql
```

**Option 2 — Dashboard:**  
Supabase → SQL Editor → New query → paste entire file → **Run**.

### What the script returns

| Section | Content | Required for Phase 5? |
|---------|---------|------------------------|
| **1** | `pg_stat_user_tables`: approximate row counts for all `public` tables | **Yes** — fast overview |
| **2** | Commented `COUNT(*)` union for every app table | **Recommended** — uncomment and run separately if you need exact counts |
| **3** | Table total size (`pg_total_relation_size`) | **Yes** — plan import time / large tables |
| **4** | `cases` JSON size stats (`pg_column_size(stages)`) | **Yes** — case import risk |
| **5** | List all `public` base tables | **Yes** — catch tables not in repo |
| **6** | HR/TMS column inventory (commented) | Optional if you run Check B |
| **7** | Storage bucket object counts | **Recommended** — Storage phase planning |

### What to save

Create a local folder (already gitignored if under `backups/`):

```text
backups/production-checks-YYYY-MM-DD/
  row-counts-output.txt    # full terminal or SQL Editor export
```

**Phase 5 needs:**

- Row count (approx or exact) for **every** `public` table you plan to import  
- **Section 4** case JSON size summary  
- **Section 3** size ordering (identify largest tables)  
- **Section 5** full table list (compare to `worker` schema + HR/TMS list)

---

## Check B — HR/TMS DDL metadata

These **seven** tables are named in the Phase 4 plan and export scripts but have **no DDL in this repository**:

| # | Table name |
|---|------------|
| 1 | `hr_walk_in_applications` |
| 2 | `hr_kyc_intake` |
| 3 | `hr_onboarding_tracks` |
| 4 | `hr_job_postings` |
| 5 | `malcon_tms_profiles` |
| 6 | `malcon_tms_tasks` |
| 7 | `malcon_tms_activity` |

D1 still has **placeholders** until real DDL is known.

### Script

[`scripts/production-ddl-check.sql`](scripts/production-ddl-check.sql)

### Where to run

**Option 1 — CLI:**

```bash
cd /path/to/malcon-nexus
npx supabase db query --linked -f scripts/production-ddl-check.sql
```

**Option 2 — Dashboard:** SQL Editor → paste → Run.

### What the script returns

| Section | Content | Required for Phase 5? |
|---------|---------|------------------------|
| **0** | EXISTS / MISSING per expected HR/TMS table | **Yes** |
| **1** | All columns: type, nullable, default | **Yes** — rebuild Drizzle schema |
| **2** | PRIMARY KEY and UNIQUE constraints | **Yes** |
| **3** | FOREIGN KEYs with ON UPDATE/DELETE | **Yes** |
| **4** | CHECK constraints | **Yes** if any |
| **5** | Index definitions (`pg_indexes`) | **Yes** |
| **6** | Approx row counts via `pg_stat_user_tables` (per HR/TMS table) | **Yes** — import scope; run exact `COUNT(*)` only for tables marked EXISTS in section 0 |
| **7** | RLS enabled flags | **Recommended** — Worker auth design |

Section **6** uses `pg_stat` only and will not error if a table is missing (approx count 0 + stat note). Use section **0** for EXISTS vs MISSING. For exact HR/TMS counts, run `SELECT COUNT(*) FROM <table>;` only for tables that exist.

### What to save

```text
backups/production-checks-YYYY-MM-DD/
  hr-tms-ddl-output.txt    # full output of production-ddl-check.sql
```

**Phase 5 needs:**

- Complete section **0–5** output for every table that **EXISTS**  
- Section **6** row counts for import planning  
- If a table is **MISSING**, document that explicitly (no invented schema)

### Optional extra (not in repo script)

If you want literal `CREATE TABLE` statements for documentation only:

```bash
# Read-only schema dump for one table (run locally; requires DB password / pooler)
# pg_dump --schema-only --table=public.hr_walk_in_applications ...
```

Only use Supabase-supported **read-only** paths you already trust. The `production-ddl-check.sql` output is sufficient to author `worker/src/db/schema.ts` changes in a later phase.

---

## After you finish

1. Store both output files under `backups/production-checks-YYYY-MM-DD/` (do **not** commit secrets or PII dumps).  
2. Share summaries with whoever runs Phase 5 (table counts + HR/TMS column list).  
3. Do **not** start Phase 5 until:
   - Row counts/sizes are recorded  
   - HR/TMS EXISTS/MISSING and column metadata are recorded for each table that exists  

---

## Quick reference — commands TO run

```bash
cd /path/to/malcon-nexus
npx supabase link --project-ref <YOUR_PROJECT_REF>   # if not already linked

npx supabase db query --linked -f scripts/production-row-counts.sql \
  | tee backups/production-checks-$(date +%Y-%m-%d)/row-counts-output.txt

npx supabase db query --linked -f scripts/production-ddl-check.sql \
  | tee backups/production-checks-$(date +%Y-%m-%d)/hr-tms-ddl-output.txt
```

Create the backup directory first if needed:

```bash
mkdir -p "backups/production-checks-$(date +%Y-%m-%d)"
```

---

## Status (Phase 4.6 deliverables)

| Deliverable | Location |
|-------------|----------|
| Row count SQL (existing) | `scripts/production-row-counts.sql` |
| HR/TMS DDL SQL (new) | `scripts/production-ddl-check.sql` |
| This checklist | `PHASE_4_6_PRODUCTION_CHECKLIST.md` |

No production commands were executed as part of creating Phase 4.6.

---

PHASE 4.6 COMPLETE: YES

READY FOR PRODUCTION CHECKS: YES
