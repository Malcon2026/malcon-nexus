# Malcon Nexus — Phase 2: Cloudflare D1 Architecture & Schema Design

**Status:** Design / foundation only  
**Production:** Unchanged — SPA → Supabase  
**Created:** Phase 2 deliverable  

---

## 1. Target architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  TODAY (unchanged)                                          │
│  Hostinger static SPA ──HTTPS──► Supabase (PG+Auth+Storage) │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TARGET (after phased cutover)                              │
│  Hostinger SPA ──HTTPS──► Cloudflare Worker API             │
│                              ├─ Drizzle ORM                 │
│                              ├─ D1 (SQLite)                 │
│                              └─ R2 (photos, Phase 10+)      │
│  Supabase decommissioned only after rollback window         │
└─────────────────────────────────────────────────────────────┘
```

**Why Worker is mandatory:** D1 has no public PostgREST endpoint. The browser cannot hold D1 credentials. All database access moves server-side.

---

## 2. Worker architecture

| Layer | Responsibility |
|-------|----------------|
| `src/index.ts` | Fetch handler, CORS, routing (Hono in Phase 8) |
| `src/middleware/auth.ts` | JWT / session → `AuthIdentity` |
| `src/middleware/authorization.ts` | Role + row-level rules (ex-RLS) |
| `src/routes/*` | REST handlers mirroring `sb*Repo` |
| `src/services/*` | Transactions, RPC ports, validation |
| `src/db/schema.ts` | Drizzle table definitions |
| `src/db/client.ts` | Per-request Drizzle client |

**Stub today:** `/health` returns OK; all other paths → `501`. SPA not configured to call Worker.

---

## 3. D1 schema overview

- **Source of truth for mapping:** `supabase/schema.sql` + `supabase/migrations/*.sql` (73 files) — **not deleted, not modified**.
- **Implementation:** `worker/src/db/schema.ts` (Drizzle SQLite).
- **SQL migrations:** Generated in Phase 3 via `drizzle-kit generate` → `worker/drizzle/migrations/` (folder prepared; **not applied to production**).

---

## 4. Drizzle schema plan

- Package: `drizzle-orm` + `drizzle-kit` in `worker/package.json` (install in Phase 3).
- Dialect: `sqlite` (D1).
- Naming: Drizzle camelCase properties → SQL snake_case columns (`.notNull()`, `.references()`).
- JSON: `text()` + application `JSON.parse` / `JSON.stringify`; optional JSON1 in raw SQL for filters later.
- Money: `amount_minor`, `invoice_amount_minor` as **INTEGER**; transform from PG `NUMERIC` on import (×100, round).

---

## 5. Table mapping (PostgreSQL → D1)

| PostgreSQL table | D1 table | In SPA today |
|------------------|----------|--------------|
| `employees` | `employees` | Yes |
| `hospitals` | `hospitals` | Yes |
| `doctors` | `doctors` | Yes |
| `departments` | `departments` | Yes |
| `surgical_kits` | `surgical_kits` | Yes |
| `cases` | `cases` | Yes |
| `notifications` | `notifications` | Yes |
| `approvals` | `approvals` | Yes |
| `activity_log` | `activity_log` | Yes (admin deferred) |
| `attendance_records` | `attendance_records` | Yes |
| `attendance_approval_requests` | `attendance_approval_requests` | Yes |
| `field_team_attendance_approvals` | `field_team_attendance_approvals` | Yes |
| `leave_requests` | `leave_requests` | Yes |
| `petrol_requests` | `petrol_requests` | Yes |
| `location_trips` | `location_trips` | Yes |
| `employee_food_selections` | `employee_food_selections` | Yes |
| `employee_daily_expenses` | `employee_daily_expenses` | Yes |
| `case_task_requests` | `case_task_requests` | Yes |
| `case_alert_escalations` | `case_alert_escalations` | Yes (alerts EF) |
| `app_settings` | `app_settings` | Yes |
| `login_otps` | `login_otps` | Yes (OTP EF) |
| `push_subscriptions` | `push_subscriptions` | Yes |
| `hospital_trip_punches` | `hospital_trip_punches` | Legacy / low use |
| `hr_*`, `malcon_tms_*` | placeholder + `payload` JSON | **No references in `src/`** |

---

## 6. Column mapping & type conversions

| PostgreSQL | D1 / Drizzle | Notes |
|------------|--------------|-------|
| `UUID` | `TEXT` | Preserve string UUIDs from export |
| `JSONB` | `TEXT` | Valid JSON string |
| `TIMESTAMPTZ` | `TEXT` | ISO-8601 UTC (IST display stays in app) |
| `DATE` | `TEXT` | `YYYY-MM-DD` |
| `BOOLEAN` | `INTEGER` 0/1 | Drizzle `mode: 'boolean'` |
| `DOUBLE PRECISION` | `REAL` | GPS |
| `NUMERIC(10,2)` etc. | `INTEGER` minor units | petrol, invoice, expenses |
| `CHECK` enums | `TEXT` | Validate in Worker + TS types |
| `auth.users` FK | `employees.auth_user_id TEXT` | Opaque external auth subject |
| `gen_random_uuid()` | App / Worker `crypto.randomUUID()` | On insert |
| Partial unique indexes | SQLite partial `WHERE` | Drizzle `uniqueIndex().where(sql\`...\`)` |

**Auth.users:** We do **not** replicate Supabase `auth.users`. `employees.auth_user_id` stores the Supabase user UUID during hybrid period; Phase 9 may map to Worker-issued JWT `sub`.

---

## 7. Foreign keys & referential actions

Recreated in Drizzle (SQLite FK enforcement with `PRAGMA foreign_keys=ON`):

| Child | Parent | On delete |
|-------|--------|-----------|
| `doctors.hospital_id` | `hospitals` | SET NULL |
| `cases.hospital_id` | `hospitals` | **RESTRICT** |
| `cases.doctor_id` | `doctors` | SET NULL |
| `cases.assigned_employee_id` | `employees` | SET NULL |
| `notifications` | `cases`, `employees` | CASCADE |
| `approvals`, `case_task_requests`, `case_alert_escalations` | `cases` | CASCADE |
| Most employee-owned rows | `employees` | CASCADE |

---

## 8. Indexes (query-driven, not PG copy)

| Table | Index | Rationale |
|-------|-------|-----------|
| `cases` | `(status, current_stage, updated_at)` | Admin board, TV lightweight lists |
| `cases` | `assigned_employee_id` | Employee "my cases" |
| `cases` | `hospital_id`, `surgery_date` | Filters |
| `notifications` | `(recipient_id, created_at DESC)` | Inbox pagination |
| `notifications` | `(recipient_id, is_read)` | Unread counts |
| `activity_log` | `created_at DESC` | Admin tail only (never full scan) |
| `attendance_records` | `(employee_id, punched_at)` | Register + date range |
| `employees` | `auth_user_id` | Session → employee |
| `doctors` | `hospital_id` | Hospital filter |

**Omitted on purpose:** GIN/jsonb indexes (SQLite JSON1 optional later); duplicate PG indexes with no query match.

---

## 9. Authorization architecture

```text
HTTP Request
  → auth middleware (Bearer JWT — Supabase today, Worker later)
  → load employee by auth_user_id
  → role from employees.role
  → authorization helpers (requireRole, canReadCase, …)
  → Drizzle query with scoped WHERE (never rely on client filtering alone)
```

**Interfaces (implemented as stubs):** `getCurrentUser`, `getCurrentEmployeeId`, `getCurrentRole`, `requireRole`, `requireEmployeeAccess`, `canReadCase` — see `worker/src/middleware/`.

**Roles:** `admin`, `employee`, `petrol`, `store_manager` — port RLS matrices from migrations (store manager case/attendance/doctor rules).

**Not connected to production in Phase 2.**

---

## 10. RPC replacement design (services — not implemented)

### `save_case_for_session(p_case jsonb)`

| Aspect | Detail |
|--------|--------|
| **Inputs** | Full case JSON (camelCase in app → snake in DB); must include `id` |
| **Outputs** | `204` or updated case summary |
| **Auth** | Admin: any case. Employee: `assigned_employee_id === current employee` (matches PG RPC) |
| **DB ops** | `SELECT … FOR UPDATE` equivalent: D1 batch transaction; `UPDATE cases SET …` merging provided fields |
| **Transaction** | **Required** — single case row update |
| **Validation** | Valid UUID id; case exists; assignee check for non-admin |
| **Failure** | 404 case not found; 403 assignee mismatch; 400 invalid id |

### `sync_case_header_from_stages(p_case_id uuid)`

| Aspect | Detail |
|--------|--------|
| **Inputs** | `caseId` |
| **Outputs** | `void` / updated header fields |
| **Auth** | Non-admin must be assignee on a stage in `stages` JSON (parallel workflow) |
| **DB ops** | Read `stages`; compute first non-Approved open stage; update `current_stage`, `assigned_employee_id`, `status` |
| **Transaction** | **Required** |
| **Validation** | Port PL/pgSQL loop logic to TypeScript (`employee_is_assignee_on_stages`) |
| **Failure** | 403 not assigned; 404 not found |

### `submit_own_leave(...)`

| Aspect | Detail |
|--------|--------|
| **Inputs** | id?, leave_type, from_date, to_date, reason, comp_off_work_date? |
| **Outputs** | Created leave row |
| **Auth** | Employee linked to session |
| **DB ops** | `INSERT leave_requests` |
| **Transaction** | Single insert |
| **Validation** | Types ∈ allowed set; dates valid; reason length ≥ 10 |
| **Failure** | 401 unlinked employee; 400 validation |

### `submit_own_food_meals(meal_date, breakfast, lunch, dinner)`

| Aspect | Detail |
|--------|--------|
| **Inputs** | meal date + booleans |
| **Outputs** | Food selection row |
| **Auth** | Employee linked to session |
| **DB ops** | Upsert on `(employee_id, meal_date)`; reject if `submitted_at` already set |
| **Transaction** | **Required** |
| **Validation** | At least one meal true |
| **Failure** | 409 already submitted |

---

## 11. API contract (replace `sb*Repo` — document only)

Base URL (future): `https://api.malconnexus.com` or `workers.dev` staging.

**Conventions:** JSON camelCase responses; `Authorization: Bearer`; pagination `?cursor=&limit=`; errors `{ error: string }`.

### Employees
- `GET /api/employees` — admin/store_manager; paginated; **no `select *` bloated fields**
- `GET /api/employees/:id`
- `POST /api/employees` — admin
- `PATCH /api/employees/:id`

### Cases
- `GET /api/cases` — **paginated**, role-scoped; query: `status`, `stage`, `assignedTo`, `hospitalId`, `updatedSince`
- `GET /api/cases/summary` — list columns only (no `stages`) for boards/TV
- `GET /api/cases/:id` — full detail including JSON fields
- `POST /api/cases`
- `PATCH /api/cases/:id`
- `POST /api/cases/:id/save-session` → `save_case_for_session`
- `POST /api/cases/:id/sync-header` → `sync_case_header_from_stages`

### Hospitals / doctors / departments / kits
- `GET /api/hospitals`, `GET /api/doctors`, `GET /api/departments`, `GET /api/kits`
- Admin mutations as today

### Notifications
- `GET /api/notifications?limit=50&cursor=` — **never unbounded**
- `PATCH /api/notifications/:id/read`
- `POST /api/notifications/mark-all-read`

### Attendance
- `GET /api/attendance?employeeId=&from=&to=&limit=`
- `POST /api/attendance/punch`
- Approval request endpoints mirror repos

### Leave / food / petrol / trips / expenses / task requests / settings
- Mirror existing repository methods with pagination + role scope

### Bootstrap replacement (egress-critical)
- `GET /api/bootstrap/essential` — role-specific **minimal** bundle
- `GET /api/bootstrap/deferred` — optional second fetch
- Replaces monolithic parallel `getAll()` in `bootstrap.ts`

---

## 12. Pagination strategy

| Collection | Default limit | Max | Notes |
|------------|---------------|-----|-------|
| `notifications` | 50 | 200 | Cursor on `created_at,id` |
| `activity_log` | 100 | 500 | Admin only; date filter required |
| `cases` (list) | 50 | 100 | Summary projection |
| `cases` (employee) | assigned + pool only | — | No full table scan |
| `attendance` | 100 | 500 | Required `from`/`to` for admin |

---

## 13. Egress optimization strategy (API design rules)

**Must not reproduce Supabase anti-patterns:**

1. **No** full-table `cases` fetch for TV — `GET /api/cases/summary?updatedSince=` every 30s max.
2. **No** 73k notifications — paginate + archive policy (future job).
3. **No** `select('*')` on list endpoints — explicit column lists.
4. **Role-scoped queries in SQL**, not fetch-all-filter-in-JS.
5. **ETag / If-None-Match** on summary endpoints for TV/gallery (Phase 8+).
6. **Separate** photo metadata endpoint; images from R2 CDN (Phase 10).
7. Client bootstrap cache TTL retained; API supports `If-Modified-Since`.

---

## 14. R2 architecture (design only)

```text
Worker POST /api/storage/presign-upload  → R2 presigned PUT
Worker GET  /api/storage/presign-download → short-lived signed GET
Buckets: stage-photos, attendance-selfies (private)
```

**URL migration:** Store `https://…/object/...` today → `r2://key` or `https://cdn…/key` tomorrow; one-time backfill script rewrites:

- `cases.stages[].documents[].url`
- `attendance_records.selfie_url`
- `attendance_approval_requests.selfie_url`
- `petrol_requests.receipt_url`, `kms_photo_url`

**Do not make R2 public by default.**

---

## 15. Environment variables & bindings

| Binding / var | dev | staging | prod | Secret? |
|---------------|-----|---------|------|---------|
| `DB` (D1) | local | staging id | prod id | no |
| `ENVIRONMENT` | development | staging | production | no |
| `API_CORS_ORIGIN` | localhost:5173 | staging URL | app.malconnexus.com | no |
| `JWT_SECRET` | .dev.vars | secret | secret | **yes** |
| R2 bindings | optional | yes | yes | no |
| Telegram/Resend/VAPID | — | secrets | secrets | **yes** |

SPA (future): `VITE_MALCON_API_URL` — **not added in Phase 2** (Supabase env unchanged).

---

## 16. Local development architecture

- `wrangler dev` + local D1 (`database_id = "local"`).
- Drizzle migrations applied with `wrangler d1 migrations apply --local`.
- CORS to Vite dev server.
- SPA still points to Supabase unless dev explicitly sets API URL flag.

---

## 17. Staging architecture

- Worker: `malcon-nexus-api-staging`
- D1: separate database; anonymized or restored subset of data
- Hostinger staging build (optional) with `VITE_MALCON_API_URL` for QA only
- Supabase production **untouched**

---

## 18. Production architecture

- Worker route on subdomain (e.g. `api.malconnexus.com`)
- D1 production database with replication/backups via Cloudflare
- SPA cutover via feature flag + env
- R2 + CDN for photos
- Supabase read-only fallback during rollback window

---

## 19. Data migration strategy (repeatable — not executed in Phase 2)

```text
1. Export Supabase (pg_dump or export-supabase-backup-sql.mjs when available)
2. Transform script (Node): PG types → D1 types
   - UUID → text
   - JSONB → JSON.stringify
   - NUMERIC → minor integer
   - timestamptz → ISO text
3. Validate: row counts per table, FK sample checks, cases.stages JSON parse
4. Import: wrangler d1 execute / batch INSERT in dependency order
5. Reconcile: employees.auth_user_id, case_numbers unique
6. Sign-off checklist before any SPA flag flip
```

**Order:** departments → hospitals → employees → doctors → kits → cases → dependents.

---

## 20. Rollback strategy

- Keep Supabase project and env vars until D1 passes staging + production canary.
- Hostinger releases tagged; revert = previous static bundle + Supabase env only.
- D1 imports are snapshots — keep export files for re-import.
- No destructive Supabase changes during Phases 2–12.

---

## 21. Risks

| Risk | Mitigation |
|------|------------|
| D1 size / row limits for fat `cases.stages` | Monitor largest rows; archive old cases later |
| SQLite write contention | Single writer; batch writes; avoid long transactions |
| HR/TMS unknown schema | Export DDL from prod before import; placeholders upgraded |
| Auth hybrid complexity | Keep Supabase Auth until Phase 9 stable |
| Partial index differences | Test upserts (food, petrol open request) |
| JSON stage authorization | Port `canReadCase` carefully; add tests |
| Egress moves to Worker | Still optimize payloads; R2 for bytes |

---

## 22. Open questions

1. Exact DDL for `hr_*` and `malcon_tms_*` from production Supabase?
2. Subdomain + Cloudflare DNS for API?
3. Store manager RLS matrix — single doc for Worker authorization?
4. Retention policy for notifications / activity_log (archival)?
5. Hybrid period: Supabase Auth + D1 data — accept dual egress briefly?
6. TV/gallery: dedicated read-only token endpoints (like today) on Worker?

---

## 23. Cases table — JSON fields (shapes)

| Column | Type in D1 | Expected shape |
|--------|------------|----------------|
| `hospital_snapshot` | JSON text | `{ id, name, branch, city, … }` |
| `doctor_snapshot` | JSON text | `{ id, name, doctorCode?, … }` |
| `assigned_employee_snapshot` | JSON text | `{ id, name, department, … }` |
| `post_surgery_duties` | JSON text | Normalized duties object from `normalizePostSurgeryDuties` |
| `stages` | JSON text | Array of stage objects: `stage`, `status`, `assignedEmployee`, `assistantEmployee`, `documents[]`, timestamps, notes |
| `activity_logs` | JSON text | Legacy embedded log array (prefer `activity_log` table for new data) |
| `comments` | JSON text | Comment thread array |

**Do not normalize** these in Phase 2 migrations.

---

## Production-only tables (investigation)

Grep of `src/` shows **zero** references to `hr_*` or `malcon_tms_*`. They appear only in `scripts/export-supabase-backup-sql.mjs`.

**Conclusion:** Not required for SPA functionality; include **placeholder** tables in D1 for import parity. Before Phase 6, run `information_schema` export on Supabase and replace placeholders with real columns.

---

## D1 suitability notes

| Feature | Suitable? | Alternative |
|---------|-----------|-------------|
| Core ERP tables | Yes | — |
| Large JSON in `cases` | Yes with monitoring | Archive / compress old stages |
| PL/pgSQL RPCs | No | Worker TypeScript services |
| RLS | No | Worker authorization |
| Supabase Auth | N/A on D1 | Keep external until Phase 9 |
| Realtime | N/A (unused) | — |
| Full-text search | Limited | FTS5 or external search later |

---

*End of Phase 2 architecture document.*
