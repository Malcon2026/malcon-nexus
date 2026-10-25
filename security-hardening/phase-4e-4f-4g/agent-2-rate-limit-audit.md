# Agent 2 — Rate limiting audit (read-only)

**Account:** 353728888679 · **Region:** ap-south-1

## Application layer

| Location | Mechanism | Scope |
|----------|-----------|--------|
| `worker/src/lib/memoryRateLimit.ts` | In-process sliding window | **Single task only** |
| `worker/src/services/cloudflareAuth.ts` | Login / OTP limits (10–12 / 15 min) | Per ECS task |
| `aws-api` / main `handleRequest` | **No global API rate limit** | — |

Code comment explicitly directs **API Gateway throttling** for fleet-wide limits.

## Edge options (preferred order)

1. **API Gateway HTTP API stage** — `ThrottlingRateLimit` + `ThrottlingBurstLimit` on `$default` (no code deploy).
2. **WAF rate-based rule** — IP aggregation at edge (works with HTTP API association).
3. **App middleware** — Only if edge insufficient; would need Redis/DynamoDB for multi-task ( **not justified** at desired=1).

## API Gateway (live)

- Stage: `$default`, auto-deploy on
- `DefaultRouteSettings`: metrics off, **no throttle overrides**
- Single route: `ANY /{proxy+}`

## Proposed limits (conservative)

| Control | Suggested value | Rationale |
|---------|-----------------|-----------|
| Stage rate | 50 req/s | Small HR app; headroom for bursts |
| Stage burst | 100 | Matches AWS common pattern |
| WAF rate rule | 2000 req / 5 min / IP | Anti-scrape; above normal user |

## Redis / ElastiCache

**Not recommended** — single Fargate task, edge limits sufficient.

## Rollback

- Revert stage `DefaultRouteSettings` to prior (no throttling, metrics false).
- Remove or set WAF rate rule to COUNT-only.
