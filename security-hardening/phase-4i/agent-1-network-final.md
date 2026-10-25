# Agent 1 — Network final audit (read-only)

**Account:** 353728888679 · **Region:** ap-south-1 · **Captured:** 2026-10-18T12:21:53+0530 (see `live-capture/captured-at-local.txt`)

## ECS service

| Check | Live evidence | Result |
|-------|---------------|--------|
| Service stable | `desiredCount=1`, `runningCount=1`, PRIMARY rollout **COMPLETED** | **PASS** |
| Task definition | `malcon-nexus-api:6` | **PASS** (baseline) |
| Public IP | `assignPublicIp=DISABLED` | **PASS** |
| Subnets | `subnet-0b85d704dd4411184`, `subnet-07ad0e3edcf0a9067` (4B private pair) | **PASS** |
| ECS SG | `sg-0baa11bbe7369985a` — **8080 from ALB SG only** | **PASS** |

Artifact: `live-capture/ecs-service.json`

## Security groups (live)

| SG | Ingress | Result |
|----|---------|--------|
| `malcon-nexus-alb-sg` (`sg-0c07d255987eba640`) | 80/443 from `0.0.0.0/0` | **Expected** (public ALB) |
| `malcon-nexus-ecs-sg` | 8080 from ALB SG only | **PASS** |
| `malcon-nexus-rds-sg` | 5432 from ECS SG only | **PASS** |

Artifacts: `live-capture/sg-sg-*.json`

## VPC endpoints (live)

| Service | State |
|---------|--------|
| S3 gateway | available |
| ECR api / dkr | available |
| Secrets Manager | available |
| CloudWatch Logs | available |

Artifact: `live-capture/vpc-endpoints-key.json`

## ALB & bypass path

| Path | Probe | Result |
|------|-------|--------|
| API Gateway → app | `/health` 200 | **PASS** |
| Internet → ALB HTTP | `http://malcon-nexus-api-52587427.ap-south-1.elb.amazonaws.com/health` → **200** | **INFO** — documented bypass; WAF covers ALB; not APIGW-only ingress |

Artifact: `live-capture/probe-results.txt`, `live-capture/alb-listeners.json` (HTTP :80 only; no HTTPS listener)

## Target health

One target **healthy**, one **draining** (post-`:6` deploy) — acceptable during steady-state transition.

Artifact: `live-capture/alb-target-health.json`

## Verdict

**PASS** — Private Fargate, least-privilege SG chain, VPC endpoints intact. Residual **public ALB** path unchanged since 4B (mitigated by WAF on ALB, not eliminated).
