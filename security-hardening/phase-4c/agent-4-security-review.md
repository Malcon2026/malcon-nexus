# Agent 4 — Security / rollback review

## Leakage controls

| Risk | Mitigation |
|------|------------|
| Secret values in task definition JSON | `secrets[]` valueFrom only; gate blocks plaintext |
| Git commit of task def | `.ecs-task-def*.json` gitignored; committed artifact `generated-task-definition.json` has no secret values |
| Logs printing secrets | Do not log task def env; SM fetch errors log message only |
| Accidental rotation | Register path reads SM keys only; **no** `PutSecretValue` |
| DATABASE_URL change | Injection uses existing SM value; no SM writes |

## IAM

- Execution role: scoped `GetSecretValue` — **sufficient** for ECS injection.
- Task role: remove SM after confirming no runtime fetch (post-image deploy).

## ARN / key reference

- Use **describe-secret ARN** + `:JSON_KEY::` suffix (standard ECS JSON key reference).
- All six required keys exist in SM (Agent 1).

## Rollback

- Service → `malcon-nexus-api:4` (unchanged revision).
- Re-attach task role `ReadApiSecret` if rolled back to image that runtime-fetches SM.

## Contradictions resolved at reconciliation

- Task def :4 missing JWT/ALERT in env → must add to **`secrets[]`** even though not in current env list.
- Runtime SM still used today → **image rebuild** needed before task role SM removal.

## Approval

**Proceed** with register + deploy + validate + IAM trim after image push.
