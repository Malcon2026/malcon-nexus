# Agent 5 — Edge, WAF & TLS final audit (read-only)

**Account:** 353728888679 · **Region:** ap-south-1

## TLS: API Gateway → ALB

| Segment | Encryption | Classification |
|---------|------------|----------------|
| Client → API Gateway | TLS (AWS-managed `execute-api`) | **PASS** |
| API Gateway → ALB | **HTTP** (`IntegrationUri`: `http://malcon-nexus-api-52587427.ap-south-1.elb.amazonaws.com/{proxy}`) | **DEFERRED** (Phase 4G) |
| ALB → ECS targets | HTTP :8080 in VPC | **PASS** (internal hop) |

Artifacts: `live-capture/apigw-integrations.json`, `live-capture/alb-listeners.json`

## ACM & ALB HTTPS

| Check | Result |
|-------|--------|
| `list-certificates` (ap-south-1) | **Empty** |
| ALB listeners | **HTTP :80 only** (no :443 listener) |

Artifacts: `live-capture/acm-certs.json`, `live-capture/alb-listeners.json`

**TLS hop verdict:** **DEFERRED** — Same blockers as 4G (no ACM + DNS for stable API hostname). Client-facing TLS on API Gateway remains **PASS**.

## WAF

| Check | Result |
|-------|--------|
| Web ACL | `malcon-nexus-api-edge` (regional) |
| Associated resource | ALB `app/malcon-nexus-api/aa086b60f889cef0` | **PASS** |
| Rules (from 4F) | AWSManagedRulesCommonRuleSet, KnownBadInputs, rate 2000/5min/IP | **PASS** |

Artifacts: `live-capture/waf-alb-resources.json`, `security-hardening/phase-4e-4f-4g/applied/waf-rules.json`

**Note:** HTTP API v2 stage cannot host WAF association (REST-only ARN); ALB association covers APIGW `HTTP_PROXY` traffic to the same origin (4E/4F design).

## API Gateway throttling

| Setting | Value |
|---------|--------|
| Stage | `$default` |
| ThrottlingRateLimit | 50 r/s |
| ThrottlingBurstLimit | 100 |
| DetailedMetricsEnabled | **true** |

Artifact: `live-capture/apigw-stages.json`

## Direct ALB access

Internet HTTP to ALB `/health` → **200** (WAF in path for abusive traffic; not APIGW-exclusive).

## Verdict

| Area | Status |
|------|--------|
| WAF + throttle | **PASS** |
| TLS APIGW→ALB | **DEFERRED** (documented 4G) |
