# Agent 5 — Deployment / validation checklist

## 1. Baseline

- [ ] Account `353728888679`, region `ap-south-1`
- [ ] Current service on `malcon-nexus-api:4`
- [ ] Execution role has scoped `GetSecretValue`

## 2. Pre-deploy

- [ ] `node scripts/aws/register-ecs-task-secrets.mjs` (dry-run) — names only
- [ ] Pre-deploy scan PASS (`assertNoPlaintextSecrets`)
- [ ] Optional: `docker build` + ECR push for `loadSecrets.ts` change

## 3. Register & deploy

- [ ] `node scripts/aws/register-ecs-task-secrets.mjs --execute --deploy`
- [ ] Record new revision ARN
- [ ] Rolling deploy; desired count unchanged (1)

## 4. ECS / ALB health

- [ ] PRIMARY rollout COMPLETED
- [ ] Task RUNNING, no public IP (unchanged from 4B)
- [ ] ALB target healthy
- [ ] CloudWatch log stream starts without `ProductionConfigError`

## 5. API Gateway tests

- [ ] `GET /health` → 200
- [ ] `GET /health/db` → 200, database true
- [ ] Unauthenticated protected route → 401
- [ ] Bad JWT → 401
- [ ] Telegram webhook without secret → 401

## 6. Functional smoke (read-only)

- [ ] Authenticated reads if credentials available locally (optional)
- [ ] S3 health via app endpoints if available

## 7. Post-deploy secret audit

- [ ] `describe-task-definition` on **live** revision: no sensitive plaintext in `environment[]`
- [ ] All six secrets in `secrets[]`
- [ ] No secret values in repo artifacts

## 8. IAM cleanup

- [ ] Remove task role `ReadApiSecret` after image without runtime SM
- [ ] `ensure-ecs-roles.mjs --execute`

## 9. Rollback trigger

Rollback to `:4` if: task fails start, 5xx, unhealthy target, DB/auth/Telegram/S3 break.

```bash
aws ecs update-service --cluster malcon-nexus --service malcon-nexus-api \
  --task-definition malcon-nexus-api:4 --force-new-deployment --region ap-south-1
```

Re-apply task role policy with `ReadApiSecret` if using pre-4C image.
