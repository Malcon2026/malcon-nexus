# Agent 5 — Security review (4D-1 scope)

## SAFE NOW

| Item | Rationale |
|------|-----------|
| Refactor `deploy-ecs-cloudfront.mjs` to use `ecs-task-definition.mjs` | Closes plaintext task-def regression; no prod deploy required for value |
| Static tests for plaintext gate + secret list builder | Prevents reintroduction without AWS |
| RDS backup retention 7 days | No encryption/network change; standard reliability |
| RDS deletion protection | Prevents accidental destroy |
| Pre/post JSON captures under `phase-4d-1/` | Audit trail without secret values |

## DEFER

| Item | Rationale |
|------|-----------|
| Multi-AZ RDS | In-place but may cause brief failover; schedule maintenance window |
| RDS storage encryption | Requires migration / replacement — explicit phase |
| JWT / SM secret rotation | Out of scope 4D-1 |
| ALB TLS, WAF, CloudWatch alarms | Out of scope 4D-1 |
| SG / VPC / ECS networking changes | Must preserve 4B posture |
| ECS new task revision register/deploy | User stop — confirm before any `:6` rollout |

## Verification checklist (post 4D-1)

- [ ] Live task def still **`malcon-nexus-api:5`**
- [ ] Sensitive keys only in **`secrets[]`** on `:5`
- [ ] `deploy-ecs-cloudfront.mjs` has **no** `get-secret-value` → `environment[]` path
- [ ] `node scripts/aws/ecs-task-definition.test.mjs` passes
- [ ] RDS backup retention ≥ 7, deletion protection true
- [ ] API Gateway `/health` and `/health/db` 200

## Secret handling

- Never print SM `SecretString` or task def env values for sensitive keys.
- Gitignored register files may exist locally; do not commit.
