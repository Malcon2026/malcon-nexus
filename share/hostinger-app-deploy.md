# Malcon Nexus on Hostinger (`app.malconnexus.com`)

## Production URL

https://app.malconnexus.com/

Subdomain root: `public_html/app` on the `malconnexus.com` hosting account.

## Redeploy (after code changes)

```bash
npm run deploy:hostinger
```

Build uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env` / `.env.local` at build time.

## After moving off Vercel

1. **Supabase → Authentication → URL Configuration**
   - Site URL: `https://app.malconnexus.com`
   - Redirect URLs: add `https://app.malconnexus.com/**`

2. **Supabase → Edge Functions → Secrets**
   - `APP_URL` = `https://app.malconnexus.com` (emails, Telegram links)

3. **Vercel**
   - Remove custom domain from the old project (optional: delete project to free the slot).

4. **Staff bookmarks**
   - Replace any `*.vercel.app` links with `https://app.malconnexus.com`.
