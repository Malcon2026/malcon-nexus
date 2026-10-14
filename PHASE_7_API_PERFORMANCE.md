# Phase 7 — API performance rules

Malcon Nexus moved off Supabase partly to avoid **unbounded PostgREST egress**. The Worker API MUST NOT repeat those patterns.

## Hard rules

1. **No unbounded list endpoints** — every collection route uses pagination and/or a hard cap.
2. **No default full-table dumps** — never return all notifications (~73k), activity_log (~79k), or attendance history by default.
3. **List vs detail** — large JSON columns (`cases.stages`, `activity_logs`, snapshots) belong on **detail** routes only.
4. **Explicit columns** — Drizzle `select({ ... })` with named fields; **no `SELECT *`**.
5. **Parameterized queries** — Drizzle / D1 bindings only; never interpolate user input into SQL strings.
6. **Bounded limits** — `pageSize` max **100** (cases/attendance); employee list capped at **100** (production ~45 rows).
7. **Targeted queries** — filter by id, employee, date range (future phases); avoid N+1 full reloads.

## Phase 7 endpoints

| Route | Protection |
|-------|------------|
| `GET /api/employees` | Max 100 rows, no sensitive columns |
| `GET /api/employees/:id/attendance` | Paginated, max pageSize 100 |
| `GET /api/cases` | Paginated list projection (no JSON blobs) |
| `GET /api/cases/:id` | Single row + parsed JSON (one case at a time) |

## Future endpoints (not Phase 7)

- `GET /api/notifications` — **must** require `recipient_id` + pagination + `since` cursor.
- `GET /api/activity-log` — admin-only, paginated, capped page size, optional date filter.
- Bulk exports — offline jobs only, not synchronous HTTP.

## Client guidance (Phase 8+)

- SPA should not poll full datasets.
- Prefer Worker pagination + If-None-Match / `updated_since` (future) over reloading all rows.
