# Phase 7 — Worker API (local development)

## Architecture

```
Browser SPA (Hostinger)     →  Supabase today (unchanged in Phase 7)
Future cutover              →  Cloudflare Worker API  →  Drizzle  →  D1
```

- **D1 is never exposed to the browser.** All data access goes through the Worker.
- **D1 has no RLS.** Authorization replaces Supabase policies in Worker middleware (`src/middleware/authorization.ts`).
- **Auth today:** Supabase Auth in the SPA. Worker auth is **stubbed** until Phase 9 (JWT verification + `employees.auth_user_id` lookup).

## Local run

```bash
cd worker
npm run db:reset:local   # optional: fresh local D1 + seed
npm run db:migrate:local # if needed
npx wrangler dev --port 8787 --local
npm run test:api
```

**Do not** use `--remote` or `deploy` in Phase 7.

## Endpoints (Phase 7)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{ ok: true, service: "malcon-nexus-worker" }` |
| GET | `/health/db` | Local dev: D1 binding + `employees` count |
| GET | `/api/employees` | Public employee list (max 100, no auth fields) |
| GET | `/api/employees/:id` | Employee detail |
| GET | `/api/employees/:id/attendance` | Paginated attendance (`page`, `pageSize` ≤ 100) |
| GET | `/api/cases` | Paginated case **list** (no large JSON) |
| GET | `/api/cases/:id` | Case **detail** with JSON fields parsed |

### Success shape

```json
{ "data": { ... } }
```

List endpoints:

```json
{
  "data": {
    "items": [ ... ],
    "pagination": { "page": 1, "pageSize": 50, "total": 555, "totalPages": 12 }
  }
}
```

### Error shape

```json
{ "error": { "code": "NOT_FOUND", "message": "Employee not found" } }
```

Codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL`.

## Auth boundary (Phase 7)

- `authenticateRequest(request, env)` → `RequestContext` (`identity`, `employeeId`, `role`).
- `requireRole`, `requireAuthenticated`, `requireEmployeeAccess`, `canReadCase` — ready for Phase 9.
- **Development:** `/api/*` reads allowed **without** `Authorization` unless `API_REQUIRE_AUTH=1`.
- **Staging/production (future):** auth required on all `/api/*` routes.

## Query safety

- Drizzle explicit column selects in `src/services/*`.
- UUID path params validated before queries.
- Pagination enforced on cases and attendance.

## Known limitations

- No write (POST/PATCH/DELETE) routes yet.
- No notifications, activity_log, or HR/TMS HTTP routes yet (mapping only).
- JWT verification not implemented.
- SPA still uses Supabase exclusively.

## Next phase (8)

- Feature-flagged SPA client for read-only employee/case routes against local/staging Worker.
- Expand endpoint coverage per `PHASE_7_API_MAPPING.md` priorities.
