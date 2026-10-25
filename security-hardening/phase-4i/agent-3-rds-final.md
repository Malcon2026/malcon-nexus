# Agent 3 — RDS final audit (read-only)

**Account:** 353728888679 · **Region:** ap-south-1 · **Captured:** 2026-10-18T12:21:53+0530

## Instances (live)

| Identifier | Encrypted | Public | Multi-AZ | Backup retention | Status | Engine |
|------------|-----------|--------|----------|------------------|--------|--------|
| **malcon-nexus-db-encrypted** | **true** | **false** | false | **1 day** | available | PostgreSQL 16.15 |
| malcon-nexus-pg (rollback) | false | false | false | 1 day | available | PostgreSQL 16.15 |

Artifact: `live-capture/rds-all.json`

## Production pointer reconciliation

| Check | Result |
|-------|--------|
| SM `DATABASE_URL` hostname | `malcon-nexus-db-encrypted…` | **PASS** |
| `GET /health/db` via API GW | **200** | **PASS** |
| 4D-2 encrypted cutover intact | No SM/RDS drift observed | **PASS** |

Artifacts: `live-capture/sm-db-host-metadata.json`, `live-capture/probe-results.txt`

## Network (from 4B + live SG)

| Check | Result |
|-------|--------|
| RDS SG 5432 from ECS SG only | **PASS** (`live-capture/sg-sg-078ca764ce05bc9c5.json`) |
| Internet → 5432 | **Unreachable** (4B validation; unchanged) |

## Reliability gaps (known deferred)

| Item | Severity | Notes |
|------|----------|-------|
| Backup retention **1 day** | **MEDIUM** | Acceptable for MVP; increase for compliance |
| **Single-AZ** | **MEDIUM** | Planned defer from 4D-1/4E |
| Rollback instance `malcon-nexus-pg` retained | **INFO** | Correct for rollback; not production |

## Phase 4D-2 statement

Production database remains **`malcon-nexus-db-encrypted`** (storage encrypted, private). Rollback **`malcon-nexus-pg`** is available and **not** referenced by AWSCURRENT `DATABASE_URL`.

## Verdict

**PASS WITH DEFERRED** — Encryption and access controls meet hardening goals; backup/Multi-AZ improvements remain operational follow-ups, not certification blockers.
