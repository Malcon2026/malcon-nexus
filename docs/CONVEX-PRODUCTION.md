# Convex production path (Hostinger)

Malcon Nexus production uses **Convex** for operational data and **Supabase Auth only** for sign-in.

## One-time setup

1. Convex project: `malcon-backend` / `malcon-nexus-ba4ec` (dev deployment provisioned via `npx convex dev --configure`).
2. Copy `.env.production.convex.example` → `.env.production.convex` and set:
   - `VITE_CONVEX_URL` / `VITE_CONVEX_SITE_URL` from Convex dashboard
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
3. Convex **production** env (`npx convex env set --prod NAME value` or Dashboard):
   - `SUPABASE_URL` — e.g. `https://ipometuqzcvdqeyvhcgg.supabase.co` (**required** for ES256 user sessions via JWKS)
   - `SUPABASE_JWT_SECRET` — optional HS256 legacy tokens (anon/service_role JWT)
   - `SUPABASE_JWT_AUD=authenticated`
   - `CONVEX_MIGRATION_KEY` — matches local value used by `npm run migrate:convex`
   - `API_CORS_ORIGIN=https://app.malconnexus.com`
4. Import data to **prod** (one-time; see **[CONVEX-MIGRATION-RUNBOOK.md](./CONVEX-MIGRATION-RUNBOOK.md)** — verify counts before any re-import):  
   `npm run migrate:convex:prod`
5. Deploy SPA: `npm run deploy:hostinger` (uses `--convex` by default; needs `.env.production.convex` with real Supabase keys)

## AWS / Worker legacy

- `npm run deploy:hostinger:aws` — deprecated
- `npm run deploy:hostinger:cutover` — Cloudflare Worker + D1 (legacy)
- `aws-api/`, `scripts/aws/` — kept for reference; not on default deploy path

## Photos / Google Drive (stage completion)

Stage photos on Convex upload to **Google Drive** via Convex HTTP routes (`/api/stage-photos/*`). Each case `Document` in row JSON can include `driveFileId` (lazy thumbnail + Drive view on tap).

### Convex production env

```bash
# Service account JSON (single line) — never commit the file
npx convex env set --prod GOOGLE_SERVICE_ACCOUNT_JSON "$(jq -c . .secrets/malcon-drive-sa.json)"

# Shared folder id (required before uploads work)
npx convex env set --prod GOOGLE_DRIVE_FOLDER_ID "<folder-id-from-drive-url>"
```

**Folder sharing (required):** In Google Drive, create or choose a folder for stage photos. Share it with  
`malcon-drive-uploader@malcon-nexus.iam.gserviceaccount.com` as **Editor**. Paste the folder id from the URL (`.../folders/<id>`) into `GOOGLE_DRIVE_FOLDER_ID`.  
**Prod folder (confirmed):** shared folder **Malcon Nexus** — id `1SzuHi4vB0Q6lmuULESHPWDyZcihEO2gY` (Editor on the service account).

### My Drive vs Shared drive (important)

Google often **rejects service-account uploads** into a folder on **personal My Drive** (`403` / “Service Accounts do not have storage quota”), even when the folder is shared with Editor.

**Fix for production uploads:**

1. Use **Google Workspace** and create a **Shared drive** (e.g. “Malcon Nexus”).
2. Add **`malcon-drive-uploader@malcon-nexus.iam.gserviceaccount.com`** as **Content manager** on that Shared drive.
3. Create **`stage-photos`** inside the Shared drive (or use the drive root).
4. Update Convex:  
   `npx convex env set --prod GOOGLE_DRIVE_FOLDER_ID "<shared-drive-folder-id>"`

Until then, stage photo **upload** may fail; existing photo URLs from the D1 import still work.

### Drive folder layout (stage photos)

Under the shared root folder (`GOOGLE_DRIVE_FOLDER_ID`, e.g. **Malcon Nexus**), uploads create:

```
Cases/
  {YYYY}/                 # IST calendar year
    {MM}/                 # IST month 01–12
      {YYYY-MM-DD}/       # IST date (surgery_date, else case created_at)
        {caseFolder}/     # CASE-{case_number} when present, else first 8 chars of case id
          {Stage}/        # Workflow stage label (e.g. Set Preparation, Delivery)
            {timestamp}-{photoId}.jpg
```

Folders are created on demand via the Drive API (`files.create`, `application/vnd.google-apps.folder`, `supportsAllDrives=true`). Each file stores `appProperties.caseId` and `appProperties.stage` (normalized workflow name) for listing.

Optional: `SUPER_ADMIN_EMAILS` — comma-separated emails allowed to load thumbnails / open Drive links (defaults match `VITE_SUPER_ADMIN_EMAILS` in the SPA).

After rotating a leaked service-account key, revoke the old key in **GCP Console → IAM → Service accounts → Keys**, update `GOOGLE_SERVICE_ACCOUNT_JSON` on Convex prod, and delete local copies you no longer need.

## Telegram (Convex HTTP)

With **`VITE_USE_CONVEX_BACKEND=true`**, the SPA posts to **`VITE_CONVEX_SITE_URL`**:

| Route | Purpose |
|-------|---------|
| `POST /api/telegram/webhook` | Bot `/start`, `/status` — updates `employees.telegram_chat_id` in Convex |
| `POST /api/telegram/notify` | Case assignment / postpone messages (admin or store manager) |
| `POST /api/telegram/broadcast` | Admin broadcast to linked staff |
| `POST /api/case-alerts/start` | Alert 1 + escalation row |
| `POST /api/case-alerts/acknowledge` | Stop reminders when stage completed |
| `POST /api/case-alerts/process` | Cron: Alert 2 after 3h (`x-cron-secret` header) |

### Convex production env

```bash
npx convex env set --prod TELEGRAM_BOT_TOKEN "<from @BotFather>"
npx convex env set --prod TELEGRAM_WEBHOOK_SECRET "<random secret; must match Telegram setWebhook>"
# Optional — required for Alert 2 cron:
npx convex env set --prod ALERT_CRON_SECRET "<random secret>"
```

Register the webhook (reads token from `.env.local` / `worker/.dev.vars`):

```bash
node scripts/setup-telegram.mjs --convex-site https://fleet-dinosaur-954.convex.site
```

**Webhook URL:** `https://fleet-dinosaur-954.convex.site/api/telegram/webhook`

Local Convex dev only: `ALLOW_INSECURE_TELEGRAM_WEBHOOK=1` if `TELEGRAM_WEBHOOK_SECRET` is unset.

| Feature | Convex prod |
|---------|-------------|
| Admin email/password login | Works (Supabase Auth) |
| Employee OTP login (Telegram code) | **Phase 2** — still uses Supabase Edge Functions (404 on malcon-dms); needs Convex `/api/auth/request-otp` + `login_otps` rows |
| Case notify / broadcast / alert ladder | Works when `TELEGRAM_BOT_TOKEN` is set |
| Bot `/start` linking | Works when webhook points at Convex site above |

**Legacy Worker** Telegram routes remain on Cloudflare but are not the Hostinger data plane; use Convex site webhook so `telegram_chat_id` writes land in the same DB as the app.
