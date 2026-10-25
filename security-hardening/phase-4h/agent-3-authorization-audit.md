# Agent 3 — Authorization audit

## Identity model

- Application `employeeId` and `role` always from DB mapping of JWT `sub`, never from client body/query alone.
- Write helpers (`requireMappedEmployeeId`, `assertEmployeeSelfOrAdmin`) enforce self-or-elevated for mutations.

## IDOR fixes applied (4H)

| Route | Issue | Fix |
|-------|--------|-----|
| HR list reads (`/api/leave-requests`, etc.) | Unscoped `employeeId` query | `resolveEmployeeListFilter` / admin gates (local diff) |
| `/api/case-alerts/acknowledge` | Any user could ack for another `employeeId` | Non-admin must match `auth.employeeId` |
| `/api/case-alerts/start`, `/api/telegram/notify` | Any authenticated user could notify arbitrary assignee | `requireAdminOrStoreManager` |
| `/api/employees/link-auth` | Client `employeeId` vs mapped identity | Reject when `ctx.employeeId` set and differs from body |
| `/api/employees` list | Email exposure to all roles | Role-scoped roster (admin / SM / limited roster) |

## Roles

`admin`, `store_manager`, `employee`, `petrol` — enforced per-route; petrol desk has dedicated petrol write/read filters.
