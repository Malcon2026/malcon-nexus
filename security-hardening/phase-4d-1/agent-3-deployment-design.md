# Agent 3 — Canonical ECS deployment design (no prod deploy in 4D-1)

## Principle

One builder: **`taskDefinitionForRegister(baseTaskDef, region)`** in `ecs-task-definition.mjs`.

All register paths must:

1. **Base** from live revision (`ECS_BASE_TASK_DEF`, default `malcon-nexus-api:5`) or service-described ARN.
2. **Merge** non-sensitive env from base + SM key presence checks.
3. **Inject** sensitive keys only via **`secrets[]`** (`valueFrom` ARNs, no values in JSON files committed to repo).
4. **Gate** with **`assertNoPlaintextSecrets(td)`** before any `register-task-definition`.
5. **Never log** secret values (names and ARNs only).

## Script responsibilities

| Script | Build image | Build task def | Register | Update service |
|--------|-------------|----------------|----------|----------------|
| `deploy-api-ecr.mjs` | Yes | No | No | No |
| `register-ecs-task-secrets.mjs` | No | Yes (builder) | Optional `--execute` | Optional `--deploy` |
| `deploy-ecs-cloudfront.mjs` (4D-1) | Optional `--execute` | Yes (builder) | Optional `--execute` | Optional `--execute` (existing service only) |

## `deploy-ecs-cloudfront.mjs` changes

- Remove `secretEnv()` and plaintext `environment[]` assembly.
- After image tag resolved, `describe-task-definition` → `taskDefinitionForRegister` → set `containerDefinitions[0].image` to ECR URI.
- Write register JSON to `.ecs-task-def-register.json` (gitignored).
- Account gate `353728888679`.
- Dry-run: print env/secret **names**; skip `register-task-definition` unless `--execute`.
- **Do not** change VPC/subnet/SG on update path (preserve 4B `update-service` only).

## Testing (local, no AWS required for core gates)

`scripts/aws/ecs-task-definition.test.mjs`:

- `assertNoPlaintextSecrets` rejects blocklisted and heuristic sensitive names.
- `buildContainerSecrets` requires six keys; optional `LOGIN_OTP_SECRET` when present in key set.
- `buildPlainEnvironment` never emits sensitive keys.
- Optional integration: `register-ecs-task-secrets.mjs` dry-run when AWS creds present (not required in CI).

## 4D-1 execution stance

- **No ECS register/deploy to production** unless explicitly confirmed — run tests + dry-run only.
- Production remains **`malcon-nexus-api:5`**.
