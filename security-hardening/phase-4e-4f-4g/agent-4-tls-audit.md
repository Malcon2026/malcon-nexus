# Agent 4 — TLS / HTTPS feasibility (read-only)

**Account:** 353728888679 · **Region:** ap-south-1

## Path analysis

```
Browser --HTTPS--> API Gateway (njbtfquxeh.execute-api.ap-south-1.amazonaws.com)
                        |
                        HTTP (cleartext)
                        v
                   ALB :80 --> ECS :8080
```

| Segment | Encryption today |
|---------|------------------|
| Client → API Gateway | **TLS 1.2+** (AWS managed cert on execute-api) |
| API Gateway → ALB | **HTTP only** (`IntegrationUri` http://…elb.amazonaws.com) |
| ALB → ECS | HTTP within VPC (target group HTTP:8080) |

## ACM (ap-south-1)

- **No issued certificates** (`list-certificates` empty).
- **No API Gateway custom domain names**.
- **No Route 53 hosted zones** in this account (DNS likely Hostinger / external).

## ALB HTTPS listener

- **Blocked without a cert:** Cannot attach meaningful TLS to `*.elb.amazonaws.com` hostname.
- Requires: ACM cert for a **customer-owned FQDN** (e.g. `api.malconnexus.com`) + DNS validation + optional custom domain on API GW or CNAME to ALB.

## API Gateway → ALB HTTPS integration

- Technically supported if `IntegrationUri` uses `https://` and ALB presents cert matching host header.
- **Same blocker:** Need ACM cert on ALB for a stable hostname (not raw ELB DNS unless using cert for that domain via CNAME).
- Switching integration URI without cert → **integration failure** → outage.

## Strongest safe alternative (this phase)

1. **Keep** HTTP integration APIGW → ALB (availability preserved).
2. **Document deferral** of hop encryption until ACM + DNS for API hostname.
3. **Optional:** Restrict ALB SG ingress to API Gateway only — **not supported** (API GW uses dynamic AWS IPs); WAF on API GW + stage throttle reduces direct-ALB abuse risk.

## CloudFront

- Not deployed; would add TLS at edge but duplicate of API GW for API use case.

## Recommendation

**Defer ALB HTTPS and HTTPS integration** → **PASS WITH DEFERRED** for TLS hop; client-facing TLS already on API Gateway.
