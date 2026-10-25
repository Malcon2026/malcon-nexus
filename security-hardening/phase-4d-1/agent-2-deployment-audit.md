# Agent 2 — Deployment path audit (repo, read-only)

**Phase:** 4D-1  
**Goal:** Identify every path that registers or deploys ECS task definitions.

## Canonical builder (intended)

| File | Role |
|------|------|
| `scripts/aws/ecs-task-definition.mjs` | Single source: `secrets[]`, plain `environment[]`, `assertNoPlaintextSecrets()` |
| `scripts/aws/register-ecs-task-secrets.mjs` | Register (optional `--deploy`); uses builder; account gate; dry-run default |

## Non-canonical / risky paths (pre-4D-1)

| File | Issue |
|------|--------|
| **`scripts/aws/deploy-ecs-cloudfront.mjs`** | Loaded SM JSON and embedded **plaintext sensitive values** in `environment[]`; wrote `.ecs-task-def.json`; registered task def. **Primary regression vector.** |
| `scripts/aws/deploy-api-ecr.mjs` | ECR push only — **no task def** |
| `scripts/aws/deploy-lightsail-api.mjs` | Lightsail — not production ECS |
| `scripts/aws/provision-aws.mjs` | Initial provisioning — not day-2 ECS rev path |

## CI / package.json

| Location | ECS deploy? |
|----------|-------------|
| `package.json` scripts | **No** `deploy-ecs` npm script; Hostinger deploy only for frontend |
| `.github/workflows/deploy-vercel.yml` | Vercel legacy — **not** ECS |
| `.github/workflows/gallery-pages.yml` | Gallery — **not** ECS |

**Conclusion:** ECS production changes are **CLI-driven** via `register-ecs-task-secrets.mjs` and (historically) `deploy-ecs-cloudfront.mjs`. No CI auto-deploy for ECS.

## Gitignore / artifacts

- `.ecs-task-def.json`, `.ecs-task-def-register.json` — gitignored (may contain secrets if old deploy script used).
- `security-hardening/phase-4c/generated-task-definition.json` — safe template (no values).

## 4D-1 action

Refactor **`deploy-ecs-cloudfront.mjs`** to import **`ecs-task-definition.mjs`** only; remove SM-to-plaintext path; hard-fail via `assertNoPlaintextSecrets`; add static tests.
