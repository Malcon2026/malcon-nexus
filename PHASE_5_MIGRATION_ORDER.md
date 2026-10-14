# Phase 5 — D1 import order

Derived from `worker/src/db/schema.ts` foreign keys (not invented).

## Order (30 tables)

| Step | Table | Depends on |
|------|--------|------------|
| 1 | `departments` | — |
| 2 | `app_settings` | — |
| 3 | `hospitals` | — |
| 4 | `surgical_kits` | — |
| 5 | `employees` | — |
| 6 | `doctors` | `hospitals` |
| 7 | `cases` | `hospitals`, `doctors`, `employees` |
| 8 | `notifications` | `cases`, `employees` |
| 9 | `approvals` | `cases` |
| 10 | `case_task_requests` | `cases`, `employees` |
| 11 | `case_alert_escalations` | `cases`, `employees` |
| 12 | `attendance_records` | `employees` |
| 13 | `attendance_approval_requests` | `employees`, `attendance_records` (nullable) |
| 14 | `field_team_attendance_approvals` | `employees` |
| 15 | `leave_requests` | `employees` |
| 16 | `employee_food_selections` | `employees` |
| 17 | `employee_daily_expenses` | `employees` |
| 18 | `petrol_requests` | `employees` |
| 19 | `location_trips` | `employees` |
| 20 | `hospital_trip_punches` | `employees`, `hospitals` (nullable) |
| 21 | `activity_log` | — (no FK; load after core entities exist) |
| 22 | `login_otps` | `employees` |
| 23 | `push_subscriptions` | `employees` |
| 24 | `hr_job_postings` | — |
| 25 | `hr_walk_in_applications` | — |
| 26 | `hr_kyc_intake` | — |
| 27 | `hr_onboarding_tracks` | `hr_walk_in_applications`, `hr_kyc_intake` (nullable, SET NULL) |
| 28 | `malcon_tms_profiles` | — |
| 29 | `malcon_tms_tasks` | `malcon_tms_profiles` |
| 30 | `malcon_tms_activity` | `malcon_tms_profiles`, `malcon_tms_tasks` (nullable) |

## Cycles

No hard FK cycles. Soft references inside JSON (`cases.stages`, snapshots) are not FK-enforced.

## Implementation

- `scripts/migration/table-order.mjs` — `IMPORT_TABLE_ORDER`
- `scripts/import-d1-data.mjs` — follows this order

## Rollback (local)

```bash
cd worker && rm -rf .wrangler/state/v3/d1 && npm run db:migrate:local
```
