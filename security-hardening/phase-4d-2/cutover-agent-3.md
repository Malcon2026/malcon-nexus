# Cutover Agent 3 — Application validation (Phase 4D-2 cutover)

**API Gateway:** `https://njbtfquxeh.execute-api.ap-south-1.amazonaws.com`

## Pre-cutover (source RDS)

| Endpoint | HTTP | Notes |
|----------|------|-------|
| `GET /health` | 200 | |
| `GET /health/db` | 200 | `database: true`, **46** employees |

## Post-cutover (encrypted RDS)

| Endpoint | HTTP | Result |
|----------|------|--------|
| `GET /health` | 200 | **PASS** |
| `GET /health/db` | 200 | **PASS** — `database: true`, **46** employees (matches clone validation) |
| `GET /api/employees` (no auth) | 401 | **PASS** |
| `GET /api/employees` (invalid JWT) | 401 | **PASS** |
| `POST /api/telegram/webhook` (no secret header) | 401 | **PASS** |
| `GET /api/employees` (`X-Malcon-Dev-Identity`) | 401 | **PASS** |

## DB attachment evidence

Production API reads the same row counts as pre-migration clone validation (`employees` 46; full parity in `post-change/validation-counts.json`). No row dumps collected.

## ALB

Target **healthy** on new task IP after deployment (prior target draining).

## CloudWatch (`/ecs/malcon-nexus-api`)

No DB connection/auth fatal lines in 15-minute post-deploy filter (credentials redacted in review).

**Verdict:** **PASS**
