# Malcon Nexus — Supabase only (database + auth)

**Live app:** https://app.malconnexus.com
**Supabase project:** `tukoefkroyxycwlkhaot` ("Nexus", org `fmoczbwjbztnvxgacwon`, region `ap-northeast-1`)
**Project URL:** https://tukoefkroyxycwlkhaot.supabase.co

Malcon Nexus is fully self-contained on this project: Postgres for data, Supabase Auth for
sessions, Supabase Edge Functions for OTP / Telegram / photo uploads. No Convex, no
Cloudflare Worker/D1, no AWS API.

> The Malcon DMS app keeps its own project (`ipometuqzcvdqeyvhcgg`) and is unaffected.

| Piece | Value |
| --- | --- |
| Data plane | Supabase Postgres (`tukoefkroyxycwlkhaot`) |
| Auth | Supabase Auth (email + password for admins, Employee ID + Telegram OTP for staff) |
| Edge Functions | 22 deployed |
| `employees` | 46 (45 linked to `auth_user_id`; `petrol` has no valid email) |
| `doctors` | 123 |
| `hospitals` | 93 |
| `cases` / `activity_log` / `notifications` | empty — new cases start here |
| Telegram webhook | `https://tukoefkroyxycwlkhaot.supabase.co/functions/v1/telegram-webhook` |

---

## What was set up

1. **Schema** — [`supabase/nexus-full-schema.sql`](../supabase/nexus-full-schema.sql)
   applied through the Management API. 26 tables, 73 RLS policies, indexes, triggers,
   functions, the 8 workflow departments, the default incentive setting, and the
   `stage-photos` / `attendance-selfies` / `petrol-receipts` storage buckets.
2. **Master data** — `node scripts/import-convex-master-data.mjs --apply` upserted
   employees / doctors / hospitals and created the Auth users.
3. **Auth users** — 45 created with passwords. **Admins have permanent passwords** stored in
   `.secrets/admin-credentials.env` (gitignored, `chmod 600`); rotate with
   `npm run auth:set-admin-password -- --password='NewPass@123'`. Staff passwords
   (`backups/auth-temp-passwords.csv`) are only a fallback — staff sign in with
   Employee ID + Telegram OTP. Supabase Auth never expires passwords and the app has no
   forced-reset flag.
4. **Edge Functions** — all 22 deployed with
   `supabase functions deploy --project-ref tukoefkroyxycwlkhaot --use-api`.
5. **Secrets** — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `LOGIN_OTP_SECRET`,
   `APP_URL`. `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are
   injected by the Edge runtime automatically.
6. **Telegram bot** — webhook repointed from Convex to the new project's
   `telegram-webhook` function, with `secret_token` = `TELEGRAM_WEBHOOK_SECRET`.
7. **App** — `.env.production.supabase` points at the new project;
   `npm run deploy:hostinger:supabase` built (0 Convex refs, 0 old-project refs) and
   deployed to Hostinger.

## Who can sign in today

| Group | Count | Method |
| --- | --- | --- |
| Admins | 4 | Email + password (permanent, `.secrets/admin-credentials.env`) |
| Store managers | 5 | Employee ID + Telegram OTP — all 5 are linked |
| Employees | 35 | Employee ID + Telegram OTP — 24 linked |

`employees.telegram_chat_id` is empty for 11 staff, so their OTP cannot be delivered yet.
Fix: send `/start` to **@Malcon_Nexus_bot** from their Telegram, which links the chat id
through `telegram-webhook`. Until then they get the generic
"If this Employee ID is registered and Telegram is linked…" message.

Employees without an `employee_code` (and the `petrol` desk accounts) cannot use OTP and
must be handled by an admin.

## Repeatable commands

```bash
# apply / re-apply the schema (idempotent)
node scripts/apply-schema-api.mjs            # needs SUPABASE_ACCESS_TOKEN

# master data + Auth users (dry run by default)
npm run db:import-master
npm run db:import-master:apply

# checks
npm run db:verify-migration

# functions
SUPABASE_ACCESS_TOKEN=sbp_... \
  npx supabase functions deploy --project-ref tukoefkroyxycwlkhaot --use-api --yes

# app
npm run deploy:hostinger:supabase
```

Required env for the scripts: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
(same names the Convex deployment used).

## Rollback

* App: `npm run deploy:hostinger:convex` (Convex production data was never deleted).
* DB: the new project is additive; nothing is shared with DMS.

## Files

| File | Purpose |
| --- | --- |
| `supabase/nexus-full-schema.sql` | Complete, idempotent schema |
| `scripts/apply-schema-api.mjs` | Applies the schema through the Management API |
| `scripts/import-convex-master-data.mjs` | Master-data import + Auth user creation/linking |
| `scripts/verify-supabase-migration.mjs` | Post-migration checks |
| `.env.production.supabase` | Production build env (gitignored) |
| `.env.production.supabase.example` | Committed template |
