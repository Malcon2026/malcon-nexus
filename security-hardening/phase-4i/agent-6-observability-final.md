# Agent 6 — Observability & alerting final audit (read-only)

**Account:** 353728888679 · **Region:** ap-south-1

## CloudWatch alarms (live)

**7** metric alarms with prefix `malcon-nexus-` (baseline met):

| Alarm | State (at capture) |
|-------|-------------------|
| malcon-nexus-alb-target-5xx | OK |
| malcon-nexus-alb-unhealthy-hosts | OK |
| malcon-nexus-apigw-5xx | OK |
| malcon-nexus-ecs-cpu-high | OK |
| malcon-nexus-rds-cpu-high | OK |
| malcon-nexus-rds-connections-high | OK |
| malcon-nexus-rds-free-storage-low | OK |

All listed alarms have **ActionsEnabled** and **AlarmActions** → SNS topic `arn:aws:sns:ap-south-1:353728888679:malcon-nexus-ops-alerts`.

Artifact: `live-capture/cloudwatch-alarms.json`

## SNS subscriptions

| Topic | Subscriptions |
|-------|----------------|
| `malcon-nexus-ops-alerts` | **0** (empty list) |

Artifact: `live-capture/sns-subscriptions.json`

**Impact:** Alarms transition to ALARM in console, but **no email/SMS/Chatops delivery** until a human subscribes (deferred from 4E).

## Logs (unchanged from 4E audit)

| Source | Status |
|--------|--------|
| `/ecs/malcon-nexus-api` | Present (ECS awslogs) |
| API Gateway access logs | **Not configured** |
| WAF logging | **Not configured** |
| ALB access logs | **Not configured** |

## ECS / deploy observability

| Check | Result |
|-------|--------|
| Service events show steady state after `:6` | **PASS** (`live-capture/ecs-service.json`) |
| `npm run test:ecs-task-def` | **9 passed** (reconciliation) |

## Verdict

**PASS WITH DEFERRED** — Alarm **coverage** complete; **notification path incomplete** (zero SNS subscribers). Logging depth remains a medium-term improvement.
