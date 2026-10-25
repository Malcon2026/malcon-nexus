# NAT Gateway cost estimate (ap-south-1)

Assumptions: **1 NAT Gateway** in one AZ (single-AZ NAT; add second for HA later).

| Component | Approximate rate | Monthly (730 h) |
|-----------|------------------|-----------------|
| NAT Gateway hourly | ~USD 0.045/h | ~USD 33 |
| NAT data processing | ~USD 0.045/GB | variable |

**Estimated baseline:** ~**USD 33–45/month** for one NAT (hourly only) plus egress GB.

**VPC endpoints (reduce NAT traffic):**

- S3 **Gateway** endpoint: no hourly charge
- Interface endpoints (ECR api/dkr, Secrets Manager, Logs): ~USD 0.01/h each × 4 ≈ USD 29/month + data

**Net:** Expect **~USD 60–90/month** combined for NAT + interface endpoints vs **~USD 33+** NAT-only with heavier NAT data charges.

Phase 4B implements **1 NAT + S3 gateway + ECR/Secrets/Logs interface endpoints** per plan.
