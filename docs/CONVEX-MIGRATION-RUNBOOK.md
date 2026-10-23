# Convex D1 JSONL migration runbook

**Agents and operators: read this before running any import.**

Production Hostinger data lives on Convex deployment **`fleet-dinosaur-954`** (`https://fleet-dinosaur-954.convex.cloud`). Dev is typically **`neighborly-lyrebird-684`** from `.env.local`. A “successful” full import log does **not** mean prod is populated unless the log line shows `target=https://fleet-dinosaur-954.convex.cloud (--prod)`.

## DO NOT re-run the full JSONL import

Full import (`npm run migrate:convex:prod` or `node scripts/migrate-to-convex.mjs --apply --prod`) walks **all 30 tables** and ~160k rows (notably **73k+ notifications**, **78k+ activity_log**). Each run burns Convex function/mutation credits and takes **~15–20 minutes**.

**Never start a full import because:**

- The Employees UI looks empty
- An API route returns 404 or wrong data
- A prior agent said “migration completed”

Those are usually **app/API bugs** or **wrong deployment**, not missing backup data.

### Verify prod counts first

Compare to `backups/d1-production-jsonl/manifest.json` (canonical expected row counts).

```bash
# Per-table total (safe for large tables)
npx convex run --prod dataQueries:listRows '{"table":"employees","limit":1}'
# → check "total" in JSON (expect 46)

# Quick sanity set
for t in employees cases notifications hospitals doctors departments; do
  npx convex run --prod dataQueries:listRows "{\"table\":\"$t\",\"limit\":1}" 2>/dev/null \
    | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);console.log('$t', j.total);});"
done
```

Expected prod totals (from Oct 2026 D1 export):

| Table | Rows |
|-------|-----:|
| employees | 46 |
| cases | 556 |
| notifications | 73228 |
| hospitals | 93 |
| doctors | 122 |
| activity_log | 78719 |

If counts match manifest → **do not import**. Fix frontend, `convex/http.ts`, auth, or Hostinger env instead.

### When a full import is allowed

Only if counts prove prod is **empty or far below manifest** (e.g. employees `total: 1` while manifest says 46) **and** you have confirmed `VITE_CONVEX_URL` is fleet-dinosaur (see below).

Use exactly:

```bash
npm run migrate:convex:prod
```

The script **refuses** prod URL without `--prod` and **refuses** `--prod` without fleet-dinosaur URL.

### Targeted fixes (preferred)

For a single missing or wrong table (e.g. employees after a partial mistake):

```bash
npm run migrate:convex:prod -- --table employees
```

Imports are **idempotent upserts** by `(table, legacy id)`; safe to re-run one table, cheap compared to full JSONL.

Do **not** use `npm run migrate:convex` (no `--prod`) for Hostinger — that targets **dev** `.env.local`.

### If a duplicate full import is already running

1. Check process: `pgrep -fl migrate-to-convex`
2. Check progress: rising `notifications` / `activity_log` totals via `listRows` above
3. **Do not kill** if prod counts were incomplete — stopping mid-run leaves prod partial
4. **Do not start a second** full import in parallel

Historical footgun (fixed in commit `5aead75`): older script overwrote CLI `VITE_CONVEX_URL` with dev from `.env.local`, so a ~21 min “prod” import could land entirely on **dev** while prod stayed at ~1 employee.

### Trim prod (cases, attendance, logs) — not a re-import

To drop operational/historical rows and **keep** reference data only (`employees`, `hospitals`, `doctors`, `departments`, `app_settings`, `surgical_kits`):

```bash
npm run purge:convex:prod:dry-run   # counts only
npm run purge:convex:prod           # batched deletes, ~15+ min on large logs
```

Requires `CONVEX_MIGRATION_KEY` in `.env.production.convex`. **Irreversible.** Prefer this over a full JSONL import when the goal is smaller storage/I/O, not restoring from backup.

## One-time prod import (reference)

See [CONVEX-PRODUCTION.md](./CONVEX-PRODUCTION.md) for env setup (`CONVEX_MIGRATION_KEY`, Supabase JWT, deploy). After counts verify, deploy SPA only if env/API changed — import alone does not require Hostinger redeploy.
