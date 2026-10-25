# Agent 6 — Implementation plan (4E + 4F + 4G)

## Sequence (safest first)

1. **Preflight capture** → `preflight/` JSON (live AWS re-verify).
2. **Observability** — SNS topic + CloudWatch alarms (no app deploy).
3. **API Gateway** — Enable detailed metrics + stage throttling (low blast radius).
4. **WAF** — Create Web ACL (managed rules + rate rule); associate to HTTP API stage; validate `/health`.
5. **TLS** — **Skip writes**; document deferral (ACM + DNS required).
6. **Validation** — API smoke, ECS/RDS checks, `npm run test:ecs-task-def`, `git diff --check`.
7. **Result** — `PHASE-4E-4F-4G-RESULT.md`.

## Rollback

| Component | Action |
|-----------|--------|
| Alarms | `delete-alarms` names `malcon-nexus-*` |
| SNS | Delete topic if no subscribers needed |
| Stage throttle | Restore empty `DefaultRouteSettings` (see preflight) |
| WAF | Disassociate Web ACL from stage; delete Web ACL |

## Risks

| Risk | Mitigation |
|------|------------|
| WAF false positive on webhook/login | Conservative rate limit; managed rules only; test health + auth after attach |
| Stage throttle too tight | 50 r/s + burst 100; monitor API GW 429 |
| TLS mis-config outage | **Do not** change integration URI without cert |
| Alarm noise | Thresholds conservative; OK actions to SNS |

## Out of scope

- Phase 4H / 4I
- Redis, app rate-limit middleware
- RDS / SM / JWT changes
- ALB HTTPS without ACM

## Success criteria

- PASS or PASS WITH DEFERRED (TLS only)
- 4D-2 encrypted RDS unchanged
- API health + auth probes pass
