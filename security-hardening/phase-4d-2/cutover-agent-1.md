# Cutover Agent 1 — RDS re-verification (Phase 4D-2 cutover)

**Account:** 353728888679 · **Region:** ap-south-1 · **Cutover:** 2026-10-18 (IST)

## Pre-cutover reconciliation

| Instance | Status | StorageEncrypted | Role |
|----------|--------|------------------|------|
| `malcon-nexus-pg` | available | false | Expected production (SM host) |
| `malcon-nexus-db-encrypted` | available | true | Cutover target |

| Snapshot | Status | Encrypted |
|----------|--------|-----------|
| `malcon-nexus-pre-encryption-20261018-1139` | available | false |
| `malcon-nexus-pre-encryption-20261018-1139-enc` | available | true |

**Verdict:** **PASS** — no material mismatch; cutover authorized.

## Post-cutover

| Instance | Status | Notes |
|----------|--------|-------|
| `malcon-nexus-pg` | available | **Retained** (rollback target; not deleted) |
| `malcon-nexus-db-encrypted` | available | **Production via `DATABASE_URL`** |

Snapshots: **unchanged**, not deleted.
