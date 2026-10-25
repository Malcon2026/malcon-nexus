# Agent 1 — WAF / edge audit (read-only)

**Account:** 353728888679 · **Region:** ap-south-1 · **Captured:** 2026-10-18

## Current topology

| Layer | Resource | Finding |
|-------|----------|---------|
| Client → API | HTTP API v2 `njbtfquxeh` | Public HTTPS endpoint; `$default` stage; **no custom domain** |
| API → origin | HTTP_PROXY integration `47yq3mq` | `http://malcon-nexus-api-52587427.ap-south-1.elb.amazonaws.com/{proxy}` |
| ALB | `malcon-nexus-api` (internet-facing) | SG `sg-0c07d255987eba640`; **HTTP :80 only** |
| CloudFront | — | **No distributions** in account |
| WAF | Regional + CloudFront scopes | **No Web ACLs** |

## WAF attachment target

- **HTTP API v2:** `AssociateWebACL` does **not** accept `/apis/.../stages/...` ARNs (REST `/restapis/...` only). **Implemented attachment: ALB** — covers API Gateway `HTTP_PROXY` and direct :80 access.

## Managed rule posture (proposed)

| Rule group | Default action | Notes |
|------------|----------------|-------|
| AWSManagedRulesCommonRuleSet | BLOCK | Baseline OWASP-style |
| AWSManagedRulesKnownBadInputsRuleSet | BLOCK | Log4j-style patterns |
| Rate-based (IP) | BLOCK @ 2000/5min | Fleet-wide edge limit; complements stage throttle |

Start without custom exclusions; tune if health checks or Telegram webhooks false-positive.

## Throttling (API GW)

- Stage `$default`: **no** `ThrottlingRateLimit` / burst; `DetailedMetricsEnabled: false`.
- **Gap:** Default AWS account limits apply only at account level; no per-stage cap.

## Logging

- No WAF logging configuration (no Web ACL yet).
- Post-deploy: enable WAF → CloudWatch Logs or S3 (optional Phase 4 follow-up; not blocking).

## Rollback (WAF)

1. `disassociate-web-acl` from stage ARN `arn:aws:apigateway:ap-south-1::/apis/njbtfquxeh/stages/$default`
2. Delete Web ACL if unused

## References

- Preflight snapshots: `preflight/apigw-api.json`, `preflight/alb.json` (from phase-4b)
- Live: `aws wafv2 list-web-acls --scope REGIONAL` → empty
