# Malcon Nexus on Hostinger (`app.malconnexus.com`)

## Production URL

https://app.malconnexus.com/

Subdomain root: `public_html/app` on the `malconnexus.com` hosting account.

## Redeploy (after code changes)

```bash
npm run deploy:hostinger
```

Build uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env` / `.env.local` at build time.

## Supabase (production)

1. **Authentication → URL Configuration**
   - Site URL: `https://app.malconnexus.com`
   - Redirect URLs: `https://app.malconnexus.com/**`

2. **Edge Functions → Secrets**
   - `APP_URL` = `https://app.malconnexus.com` (emails, Telegram links)

Staff should bookmark **https://app.malconnexus.com/** only (not legacy Vercel URLs).
