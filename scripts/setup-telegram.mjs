#!/usr/bin/env node
/**
 * Register Telegram webhook for Malcon Nexus (Convex site, Cloudflare Worker, or Supabase).
 *
 * Run:
 *   node scripts/setup-telegram.mjs
 *   node scripts/setup-telegram.mjs --convex-site https://fleet-dinosaur-954.convex.site
 *
 * Requires in .env / .env.local / worker/.dev.vars (do not commit secrets):
 *   TELEGRAM_BOT_TOKEN — from @BotFather
 *   TELEGRAM_WEBHOOK_SECRET — random string (generated below if missing)
 *
 * Target selection:
 *   --convex-site URL   → {url}/api/telegram/webhook (Convex prod default)
 *   TELEGRAM_WEBHOOK_TARGET=worker → VITE_WORKER_API_URL (legacy)
 *   TELEGRAM_WEBHOOK_TARGET=supabase → Supabase Edge Function (legacy)
 */
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const env = { ...process.env };
  for (const name of [
    '.env',
    '.env.local',
    '.env.telegram.local',
    '.env.production.convex',
    'worker/.dev.vars',
  ]) {
    try {
      const raw = readFileSync(resolve(root, name), 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    } catch {
      /* missing */
    }
  }
  return env;
}

const argv = process.argv.slice(2);
let convexSiteArg = '';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--convex-site' && argv[i + 1]) {
    convexSiteArg = argv[i + 1].replace(/\/$/, '');
    i++;
  }
}

const env = loadEnv();
const botToken = env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const workerUrl = (env.VITE_WORKER_API_URL || 'https://malcon-nexus-api.malcon-nexus.workers.dev').replace(
  /\/$/,
  '',
);
const convexSite =
  convexSiteArg ||
  (env.VITE_CONVEX_SITE_URL || '').replace(/\/$/, '') ||
  (env.CONVEX_SITE_URL || '').replace(/\/$/, '');
const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET || randomBytes(16).toString('hex');
const target = env.TELEGRAM_WEBHOOK_TARGET || (convexSite ? 'convex' : 'worker');
const useSupabase = target === 'supabase';
const useConvex = target === 'convex' || (!useSupabase && target !== 'worker' && Boolean(convexSite));

console.log('\n=== Malcon Nexus Telegram Setup ===\n');

if (!botToken) {
  console.log('1. Create bot: Telegram → @BotFather → /newbot');
  console.log('2. Add to .env or worker/.dev.vars (do not commit):');
  console.log('     TELEGRAM_BOT_TOKEN=<token from BotFather>');
  console.log(`     TELEGRAM_WEBHOOK_SECRET=${webhookSecret}`);
  console.log('3. Set Convex prod env:');
  console.log('     npx convex env set --prod TELEGRAM_BOT_TOKEN "<token>"');
  console.log('     npx convex env set --prod TELEGRAM_WEBHOOK_SECRET "<secret>"');
  console.log('4. Run this script again to register webhook.\n');
  process.exit(1);
}

let webhookUrl;
if (useSupabase) {
  webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;
} else if (useConvex) {
  if (!convexSite) {
    console.error('Missing Convex site URL. Pass --convex-site or set VITE_CONVEX_SITE_URL.');
    process.exit(1);
  }
  webhookUrl = `${convexSite}/api/telegram/webhook`;
} else {
  webhookUrl = `${workerUrl}/api/telegram/webhook`;
}

if (useSupabase && !projectRef) {
  console.error('Missing VITE_SUPABASE_URL for Supabase webhook target');
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ['message'],
  }),
});

const body = await res.json();
if (!body.ok) {
  console.error('setWebhook failed:', body.description ?? body);
  process.exit(1);
}

console.log('✓ Webhook registered');
console.log(`  URL:    ${webhookUrl}`);
console.log(`  Secret: ${webhookSecret}`);
console.log(
  `\nEnsure TELEGRAM_WEBHOOK_SECRET matches on ${useConvex ? 'Convex prod' : useSupabase ? 'Supabase' : 'Worker'}.`,
);
if (useConvex) {
  console.log('  npx convex env set --prod TELEGRAM_WEBHOOK_SECRET "<same secret>"');
}
console.log('\nEmployees connect:');
console.log('  1. Open your Malcon Nexus Telegram bot');
console.log('  2. Send: /start EMPLOYEE_CODE');
console.log('  3. Settings → Notifications in app shows status\n');
