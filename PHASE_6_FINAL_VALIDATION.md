# Phase 6 — Final data fidelity validation

**Validated at:** 2026-10-14 (UTC)  
**Production export:** `backups/production-data-2026-10-14-175253`  
**Phase 4.7 baseline:** `backups/production-checks-2026-10-14/production-row-counts-full.txt`  
**Import log:** `backups/phase6-import-optimized.log`  
**Machine-readable results:** `backups/phase6-final-validation-result.json`  
**Validator:** `node scripts/phase6-final-validation.mjs`

Production Supabase was not modified. Remote D1 was not used. The SPA was not modified.

---

## Summary

| Check | Result |
|-------|--------|
| Row counts (30/30 tables, 161,050 rows) | **PASS** |
| Primary keys | **PASS** |
| Foreign keys | **PASS** |
| NULL handling | **PASS** |
| JSON (cases + snapshots) | **PASS** |
| Timestamps (representative) | **PASS** |
| Booleans (representative) | **PASS** |
| Money / numeric | **PASS** |
| HR/TMS (7 tables) | **PASS** |
| Import completeness | **PASS** |

**PHASE 6 FINAL VALIDATION: PASS**

---

## 1. Row counts

- **30/30** tables in `IMPORT_TABLE_ORDER` compared: Phase 4.7 `COUNT(*)`, export JSONL line count, local D1 count.
- **Total rows in local D1:** **161,050** (matches Phase 4.7 sum).

Spot checks:

| Table | Phase 4.7 | D1 |
|-------|-----------|-----|
| cases | 555 | 555 |
| notifications | 73,228 | 73,228 |
| activity_log | 78,719 | 78,719 |
| attendance_records | 5,565 | 5,565 |

Empty production tables (0 rows): `petrol_requests`, `hospital_trip_punches`, `malcon_tms_tasks`, `malcon_tms_activity`.

---

## 2. Primary keys

- Every populated table: **no duplicate PKs**, **no NULL/empty PKs** (see `pkDetails` in JSON result).

---

## 3. Foreign keys

- `PRAGMA foreign_key_check` on local D1: **0 violations**.

---

## 4. NULL behavior

### `notifications.recipient_id` (special case)

Earlier pre-import scans flagged many rows with **NULL** `recipient_id`. That was **not** an orphan FK problem:

- Production export: **73,228 / 73,228** rows have **`recipient_id: null`** (100%).
- Local D1: **73,228** rows with **`recipient_id IS NULL`**, **0** with empty string `''`.
- PostgreSQL allows NULL on this column; D1 schema allows NULL; import does **not** coerce NULL → `''`.

No export orphan FKs were found for `cases`, `notifications`, or `attendance_approval_requests` (all referenced IDs present in parent JSONL files).

---

## 5. JSON / structured fields (cases)

All **555** cases compared export vs D1 for:

- `stages`
- `hospital_snapshot`
- `doctor_snapshot`
- `post_surgery_duties`
- `activity_logs`

**555/555** semantic JSON match (normalized parse/compare). **0** parse failures.

---

## 6. Timestamps

Representative samples (50 rows each) for `cases`, `employees`, `notifications`, `leave_requests`:

- `created_at` / `updated_at` strings match export where PG provides them.

**Documented intentional import transform (not corruption):**

- **`leave_requests`:** PostgreSQL has **no** `updated_at` column; D1 requires NOT NULL `updated_at`. Import sets `updated_at = created_at` when absent (`transforms.mjs`). Sampled rows reflect this consistently.

---

## 7. Booleans

- **250** rows sampled: `notifications.is_read`, `attendance_records.within_office`.
- PostgreSQL booleans imported as SQLite **0/1**; values match export.

---

## 8. Money / numeric

| Area | Check | Result |
|------|--------|--------|
| `cases` | `invoice_amount` / `collected_amount` → `*_amount_minor` (×100, rounded) | **555/555** match |
| `employee_daily_expenses` | `petrol_amount`, `food_amount`, `other_amount`, `kms_driven` as REAL | **249/249** match (no minor-unit conversion) |
| `petrol_requests` | N/A (0 rows in production) | — |

No unintended rounding beyond documented minor-unit conversion for case invoice/collected amounts.

---

## 9. HR/TMS (7 tables)

| Table | Phase 4.7 | D1 |
|-------|-----------|-----|
| hr_walk_in_applications | 8 | 8 |
| hr_kyc_intake | 5 | 5 |
| hr_onboarding_tracks | 13 | 13 |
| hr_job_postings | 3 | 3 |
| malcon_tms_profiles | 50 | 50 |
| malcon_tms_tasks | 0 | 0 |
| malcon_tms_activity | 0 | 0 |

FK check covers HR/TMS relationships; **no violations**.

---

## 10. Import completeness (`phase6-import-optimized.log`)

- Ends with **`Import complete (local D1 only).`**
- **`foreign_key_check: OK`**
- **No** `Import failed` lines
- **26** tables logged as **`✓ … verified N rows`** (per-table count assertion after load)
- **4** log lines **`skip … (no file or empty)`** — zero-row production tables, **not** skipped rows within a table:
  - `petrol_requests`
  - `hospital_trip_punches`
  - `malcon_tms_tasks`
  - `malcon_tms_activity`

---

## Known non-blocking items (unchanged in this phase)

- **`idx_petrol_book_token`:** partial unique index in PostgreSQL; not replicated in D1 (0 `petrol_requests` rows). Worker/app validation deferred to Phase 7+ planning.
- **Export report:** `PHASE_6_EXPORT_REPORT.md` (row counts vs Phase 4.7 at export time).

---

## Safety

| Item | Value |
|------|--------|
| Production Supabase modified | **NO** |
| Remote D1 touched | **NO** |
| SPA modified | **NO** |

---

## Re-run validation

```bash
node scripts/phase6-final-validation.mjs backups/production-data-2026-10-14-175253
```
