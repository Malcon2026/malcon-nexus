# PHASE 4B RESULT

**Account:** `353728888679`  
**Region:** `ap-south-1`  
**Completed (UTC):** see `post-change/captured-at.txt`  
**API Gateway:** `https://njbtfquxeh.execute-api.ap-south-1.amazonaws.com`  
**ALB:** `malcon-nexus-api-52587427.ap-south-1.elb.amazonaws.com`  

Snapshots: `preflight/`, `rollback/`, `post-change/`, `applied/` (no secret values in committed snapshots; **do not commit** `rollback/task-definition-full.json` or `preflight/task-definition-full.json`).

---

## Changes applied

| Area | Action |
|------|--------|
| Outbound | NAT Gateway `nat-0bb55f9e65c1da656` (EIP `eipalloc-003eb2287587c0809`) in public subnet `subnet-0959bc37b0db389c6`; private subnets `subnet-0b85d704dd4411184` (1a), `subnet-07ad0e3edcf0a9067` (1c); route table `rtb-0d5ea3945f7bccc49` → NAT |
| VPC endpoints | S3 gateway `vpce-0c56860fa72902566`; interface ECR api `vpce-0e12997e23712e07e`, ECR dkr `vpce-0dab935000321a47b`, Secrets Manager `vpce-037893c8e722f1a02`, Logs `vpce-02984f0de1a66efe4`; VPCE SG `sg-09610580bd8e1c742` |
| Security groups | Created `malcon-nexus-alb-sg` `sg-0c07d255987eba640`, `malcon-nexus-ecs-sg` `sg-0baa11bbe7369985a`, `malcon-nexus-rds-sg` `sg-078ca764ce05bc9c5`; ALB uses ALB SG only; ECS service uses ECS SG only |
| RDS | `PubliclyAccessible=false`; VPC SGs = RDS SG only; removed transitional ingress from old ECS SG; removed world `5432` from default SG `sg-072099247083c56fd` |
| ECS network | Private subnets + `assignPublicIp=DISABLED`; rolling deployments (incl. post-IAM redeploy) |
| IAM task role | Detached `AmazonS3FullAccess`, `SecretsManagerReadWrite`; inline `malconNexusTaskS3Secrets` from `scripts/aws/ecs-task-s3-secrets-policy.json` |
| IAM execution role | Detached `CloudWatchLogsFullAccess`; inline `malconNexusEcsExecutionLogsSecrets` (scoped logs + `GetSecretValue` on `malcon-nexus/api-env*`) |
| Validation | Private-subnet Fargate test task (ECR pull) before prod cutover; post-change API and bypass probes |

**Not changed (by design):** RDS encryption, secret rotation, task definition secret injection (still rev `:4` with plaintext env), old SGs/task defs, database endpoint/credentials, application deploy.

---

## Before / after

| Item | Before | After |
|------|--------|-------|
| ECS public IP | ENABLED (public subnets) | **DISABLED** (private subnets); ENI `Association.PublicIp` = null |
| ECS SG | Shared `sg-068dd8d11ba52fa2a` with **0.0.0.0/0 → 8080** | `sg-0baa11bbe7369985a`: **8080 only from ALB SG** |
| ALB SG | Same shared SG | `sg-0c07d255987eba640`: 80/443 from internet |
| RDS public access | `true` | **`false`** |
| RDS SG | Default SG + world 5432 | `sg-078ca764ce05bc9c5`: **5432 only from ECS SG** |
| Task IAM | S3Full + SM ReadWrite | Inline least-privilege S3 (3 buckets) + scoped SM read |
| Execution IAM | CloudWatchLogsFullAccess | Scoped `/ecs/malcon-nexus-api` + SM read for future injection |
| Outbound | Public IP / IGW | **NAT + VPC endpoints** (ECR, SM, Logs, S3 gateway) |

---

## Validation

### AWS infrastructure

| Check | Result |
|-------|--------|
| ECS desired = running (1/1) | **PASS** |
| ECS PRIMARY rollout COMPLETED | **PASS** |
| ECS task RUNNING, ALB target healthy | **PASS** (e.g. `172.31.72.124:8080`) |
| No public IP on ECS tasks | **PASS** |
| ECS subnets private + NAT route | **PASS** |
| RDS available, `PubliclyAccessible=false` | **PASS** |
| RDS SG 5432 only from ECS SG | **PASS** |
| ECS SG 8080 only from ALB SG | **PASS** |
| No world 5432 on RDS SG / default SG (active path) | **PASS** |
| Task role: no S3Full / SM ReadWrite | **PASS** |
| Execution role: scoped logs + SM read inline | **PASS** |
| ECR / SM / logs via endpoints + NAT (validated pre-cutover) | **PASS** |
| Post-IAM redeploy healthy | **PASS** |

### API (API Gateway)

| Check | Result |
|-------|--------|
| `GET /health` → 200 | **PASS** |
| `GET /health/db` → database true | **PASS** |
| Unauthenticated `/api/employees` → 401 | **PASS** |
| Invalid JWT → 401 | **PASS** |
| Dev identity header → 401 | **PASS** |
| Telegram webhook without secret → 401 | **PASS** |
| Security headers on live API | **NOT RUN** (separate check; image may predate header middleware) |

### Direct bypass

| Check | Result |
|-------|--------|
| Internet → ALB HTTP `/health` | **200** (expected; public ALB listener) |
| Internet → ECS :8080 (old public IP) | **FAIL to connect** (**PASS** — no direct ECS access) |
| Internet → RDS :5432 | **Unreachable** (**PASS**) |
| API Gateway → ALB → ECS | **PASS** |

### Application smoke / `test-security-authz.mjs`

| Check | Result |
|-------|--------|
| `scripts/test-security-authz.mjs` on production | **NOT RUN** — script uses local seed IDs and includes **POST** (`/api/case-alerts/acknowledge`); not read-only for prod |

---

## Exact resource IDs

| Resource | ID / ARN |
|----------|----------|
| ECS cluster | `malcon-nexus` |
| ECS service | `arn:aws:ecs:ap-south-1:353728888679:service/malcon-nexus/malcon-nexus-api` |
| Task definition (unchanged rev) | `arn:aws:ecs:ap-south-1:353728888679:task-definition/malcon-nexus-api:4` |
| Target group | `arn:aws:elasticloadbalancing:ap-south-1:353728888679:targetgroup/malcon-nexus-api/1d373a0e313a3b53` |
| ALB SG | `sg-0c07d255987eba640` |
| ECS SG | `sg-0baa11bbe7369985a` |
| RDS SG | `sg-078ca764ce05bc9c5` |
| RDS instance | `malcon-nexus-pg` (`malcon-nexus-pg.cpumo6uq2a4o.ap-south-1.rds.amazonaws.com`) |
| NAT | `nat-0bb55f9e65c1da656` |
| Private subnets | `subnet-0b85d704dd4411184`, `subnet-07ad0e3edcf0a9067` |
| Private RT | `rtb-0d5ea3945f7bccc49` |
| VPC endpoints | see table in “Changes applied” |
| Task role | `arn:aws:iam::353728888679:role/malconEcsTaskRole` |
| Execution role | `arn:aws:iam::353728888679:role/ecsTaskExecutionRole` |
| Secret (metadata) | `arn:aws:secretsmanager:ap-south-1:353728888679:secret:malcon-nexus/api-env-iyxZEl` |
| S3 buckets | `malcon-nexus-stage-photos-353728888679`, `malcon-nexus-attendance-selfies-353728888679`, `malcon-nexus-hr-kyc-353728888679` |
| Legacy SG (retained, not attached to ECS/ALB) | `sg-068dd8d11ba52fa2a` (still contains world 8080 rule) |

---

## Rollback

Use `rollback/` JSON as source of truth. High-level:

1. **ECS (fastest app restore)**  
   ```bash
   aws ecs update-service --cluster malcon-nexus --service malcon-nexus-api \
     --task-definition malcon-nexus-api:4 \
     --network-configuration file://security-hardening/phase-4b/rollback/ecs-network.json \
     --force-new-deployment --region ap-south-1
   ```  
   (Build `ecs-network.json` from `rollback/ecs-service.json` → `networkConfiguration.awsvpcConfiguration`: public subnets, `sg-068dd8d11ba52fa2a`, `assignPublicIp=ENABLED`.)

2. **ALB SG**  
   ```bash
   aws elbv2 set-security-groups --load-balancer-arn <from rollback/alb.json> \
     --security-groups sg-068dd8d11ba52fa2a --region ap-south-1
   ```

3. **RDS (emergency only)**  
   ```bash
   aws rds modify-db-instance --db-instance-identifier malcon-nexus-pg \
     --publicly-accessible --vpc-security-group-ids sg-072099247083c56fd \
     --apply-immediately --region ap-south-1
   ```  
   Re-add SG rules from `rollback/security-groups-current.json` if needed.

4. **IAM**  
   Re-attach `AmazonS3FullAccess`, `SecretsManagerReadWrite` to `malconEcsTaskRole`; re-attach `CloudWatchLogsFullAccess` to `ecsTaskExecutionRole`; delete inline policies `malconNexusTaskS3Secrets`, `malconNexusEcsExecutionLogsSecrets`.

5. **New infra (optional full rollback)**  
   Delete endpoints → NAT → private subnets/route associations in reverse order of creation; **do not** terminate RDS or ECS service.

Task definition revision **`:4`** remains registered for rollback.

---

## Remaining risks

- **Legacy SG `sg-068dd8d11ba52fa2a`** still allows **0.0.0.0/0 → 8080** if re-attached to a resource with a public IP.
- **ALB HTTP :80** still open to the world (no TLS on origin; API Gateway is the intended public edge).
- **Secrets in task definition env** (plaintext at rest in ECS); runtime also merges from Secrets Manager via **task role** — Phase **4C** should move injection to execution role and remove plaintext.
- **Single NAT Gateway** (one AZ); outage in that AZ affects private egress until second NAT or endpoint-only path is added.
- **NAT cost** (~$32/mo + data); see `nat-cost-estimate.md`.
- **No WAF / CloudFront**, **no RDS encryption migration**, **no secret rotation**, **no CloudWatch alarms** (prior audit findings).
- **Security headers** not verified on live API Gateway responses in this phase.

---

## Next phase (do not execute automatically)

**Phase 4C — Secret injection & env hygiene**

1. Register new task definition revision with `secrets` from `malcon-nexus/api-env` (execution role `GetSecretValue` already scoped).
2. Remove sensitive plaintext from container `environment`; rolling deploy; verify startup without task-role SM dependency if env is complete via injection only.
3. Optionally narrow task role `ReadApiSecret` after app no longer calls `loadMalconApiSecrets` at runtime.

**Phase 4D+ (separate plans):** ALB HTTPS-only / redirect, WAF, RDS encryption migration, secret rotation, delete or lock down legacy SG rules, multi-AZ NAT, monitoring alarms, redeploy API image with security headers.

---

**Phase 4B execution: STOP** (per scope).
