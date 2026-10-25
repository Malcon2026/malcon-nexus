# PHASE 4E + 4F + 4G RESULT

## Status

**PASS WITH DEFERRED** — Observability, stage throttling, and WAF on ALB deployed and validated. **TLS hop (API Gateway → ALB) deferred** until ACM certificate + DNS for a stable API hostname exist in this account.

---

## Executive summary

| Phase | Scope | Outcome |
|-------|--------|---------|
| **4E — Observability** | SNS + CloudWatch alarms | **PASS** — 7 alarms → `malcon-nexus-ops-alerts` (no subscriber in repo; subscribe in console) |
| **4F — WAF + rate limits** | WAF Web ACL + API GW throttle | **PASS** — Managed rules + IP rate limit on **ALB**; stage 50 r/s, burst 100 |
| **4G — TLS** | ALB HTTPS / HTTPS integration | **DEFERRED** — No ACM certs; client TLS remains on API Gateway |

**4D-2 production RDS `malcon-nexus-db-encrypted` unchanged** (no Secrets Manager or DATABASE_URL writes this phase).

---

## Account & anchors

| Item | Value |
|------|--------|
| Account | 353728888679 |
| Region | ap-south-1 |
| API Gateway | `https://njbtfquxeh.execute-api.ap-south-1.amazonaws.com` |
| ECS | `malcon-nexus-api:5`, secrets from `malcon-nexus/api-env` |
| Production RDS | `malcon-nexus-db-encrypted` (encrypted, private) |
| Rollback RDS | `malcon-nexus-pg` (retained) |

---

## Changes applied

### Observability (4E)

- **SNS:** `arn:aws:sns:ap-south-1:353728888679:malcon-nexus-ops-alerts`
- **Alarms:** `malcon-nexus-alb-target-5xx`, `malcon-nexus-alb-unhealthy-hosts`, `malcon-nexus-ecs-cpu-high`, `malcon-nexus-apigw-5xx`, `malcon-nexus-rds-cpu-high`, `malcon-nexus-rds-connections-high`, `malcon-nexus-rds-free-storage-low`

### Rate limiting (4F)

- **API Gateway** `$default`: `ThrottlingRateLimit=50`, `ThrottlingBurstLimit=100`, `DetailedMetricsEnabled=true`
- **WAF** `malcon-nexus-api-edge` (regional):
  - `AWSManagedRulesCommonRuleSet` (block)
  - `AWSManagedRulesKnownBadInputsRuleSet` (block)
  - Rate-based **2000 req / 5 min / IP** (block)

### WAF attachment

- **Associated to:** ALB `malcon-nexus-api` (`aa086b60f889cef0`)
- **Not associated to:** HTTP API stage — `AssociateWebACL` accepts REST stage ARNs only; HTTP API v2 stage ARNs are rejected. ALB association covers API Gateway `HTTP_PROXY` traffic to the same origin.

### TLS (4G)

- **No changes** — `list-certificates` empty; no Route 53 zones in account; integration remains `http://malcon-nexus-api-52587427.ap-south-1.elb.amazonaws.com`.
- **Next step (future):** ACM for `api.malconnexus.com` (or similar) + ALB :443 listener + optional custom domain on API GW; only then consider `https://` integration URI.

---

## Validation

| Check | Result |
|-------|--------|
| `GET /health` | **PASS** (200) |
| `GET /health/db` | **PASS** (200, database true, 46 employees) |
| Unauthenticated `/api/employees` | **PASS** (401) |
| `POST /api/telegram/webhook` (no secret) | **PASS** (401) |
| ECS 1/1, task def `:5`, private subnets, no public IP | **PASS** |
| RDS `malcon-nexus-db-encrypted` encrypted, private, available | **PASS** |
| WAF on ALB | **PASS** (listed in `list-resources-for-web-acl`) |
| CloudWatch alarms (7) | **PASS** |
| `npm run test:ecs-task-def` | **PASS** (9 tests) |
| `git diff --check` | **PASS** |

---

## Rollback

1. **WAF:** `disassociate-web-acl` from ALB ARN; delete Web ACL `malcon-nexus-api-edge` if unused.
2. **Stage throttle:** Restore preflight `preflight/apigw-stage.json` settings (no throttle, metrics false).
3. **Alarms:** Delete alarms prefixed `malcon-nexus-`.
4. **SNS:** Delete topic `malcon-nexus-ops-alerts` if no longer needed.

Artifacts: `preflight/`, `applied/`, agent audits `agent-1` … `agent-6`.

---

## Prohibitions honored

- No DATABASE_URL / Secrets Manager changes
- No RDS migration or snapshot delete
- No JWT rotation
- No Phase 4H / 4I
- No ECS networking / SG redesign

---

## Coordinator summary

**PASS WITH DEFERRED** — Edge hardening live (WAF on ALB, API GW throttling, ops alarms). Encrypted prod DB from 4D-2 intact. Subscribe an email to SNS for notifications. Plan TLS when ACM + DNS are ready.
