# Agent 3 — Observability gap analysis (read-only)

**Account:** 353728888679 · **Region:** ap-south-1

## Logs (existing)

| Log group | Purpose |
|-----------|---------|
| `/ecs/malcon-nexus-api` | ECS Fargate app (task def `:5`, awslogs driver) |
| `/aws/lambda/malcon-nexus-case-alerts-process` | Case alerts Lambda |

**Gaps:** No API Gateway access logs; no WAF logs; no ALB access logs bucket configured in audit.

## Metrics

| Source | Status |
|--------|--------|
| ALB `app/malcon-nexus-api/aa086b60f889cef0` | Standard ELB metrics available |
| API GW `njbtfquxeh` | **DetailedMetricsEnabled: false** on stage |
| ECS `malcon-nexus-api` | Service metrics available (CPU/memory) |
| RDS | Both `malcon-nexus-db-encrypted` (prod) and `malcon-nexus-pg` emit metrics |

## Alarms (live)

- **0** CloudWatch metric alarms in region (describe-alarms empty).

## SNS

- **0** topics — no notification destination for alarms.

## Recommended minimal alarm set

| Alarm | Metric | Threshold (initial) |
|-------|--------|---------------------|
| ALB 5xx | `HTTPCode_Target_5XX_Count` | ≥ 5 / 5 min |
| ALB unhealthy | `UnHealthyHostCount` | ≥ 1 / 1 min |
| ECS CPU | `CPUUtilization` (service) | ≥ 85% / 15 min |
| API GW 5xx | `5XXError` | ≥ 10 / 5 min |
| RDS CPU (encrypted) | `CPUUtilization` | ≥ 80% / 15 min |
| RDS storage | `FreeStorageSpace` | ≤ 2 GB (adjust per instance size) |
| RDS connections | `DatabaseConnections` | ≥ 80 (tune to instance max) |

## SNS strategy

- Create topic `malcon-nexus-ops-alerts` (no secrets in repo).
- **No email in repo** — topic created; human must subscribe (email/Slack) out-of-band.
- Alarms → SNS OK even without subscriber (AWS console still shows ALARM state).

## Rollback

- Delete alarms by name prefix `malcon-nexus-`
- Delete SNS topic if unused
