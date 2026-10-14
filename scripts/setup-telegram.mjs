#!/usr/bin/env node
/**
 * Register Telegram webhook for Malcon Nexus (Cloudflare Worker or Supabase).
 * Run: node scripts/setup-telegram.mjs
 *
 * Requires in .env:
 *   TELEGRAM_BOT_TOKEN — from @BotFather
 *   TELEGRAM_WEBHOOK_SECRET — random string (generated below if missing)
 *   VITE_WORKER_API_URL — production Worker URL (Cloudflare backend)
 *
 * Optional: TELEGRAM_WEBHOOK_TARGET=supabase to use legacy Supabase function URL.
 */
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const env = { ...process.env };
  for (const name of ['.env', '.env.local']) {
    try {
      const raw = readFileSync(resolve(root, name), 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m) env[m[1]] = m[2].trim();
      }
    } catch {
      /* missing */
    }
  }
  return env;
}

const env = loadEnv();
const botToken = env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const workerUrl = (env.VITE_WORKER_API_URL || 'https://malcon-nexus-api.malcon-nexus.workers.dev').replace(/\/$/, '');
const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET || randomBytes(16).toString('hex');
const useSupabase = env.TELEGRAM_WEBHOOK_TARGET === 'supabase';

console.log('\n=== Malcon Nexus Telegram Setup ===\n');

if (!botToken) {
  console.log('1. Create bot: Telegram → @BotFather → /newbot');
  console.log('2. Add to .env (do not commit):');
  console.log('     TELEGRAM_BOT_TOKEN=<token from BotFather>');
  console.log(`     TELEGRAM_WEBHOOK_SECRET=${webhookSecret}`);
  console.log('3. Set Worker secrets (production):');
  console.log('     cd worker && npx wrangler secret put TELEGRAM_BOT_TOKEN --env production');
  console.log('     cd worker && npx wrangler secret put TELEGRAM_WEBHOOK_SECRET --env production');
  console.log('4. Run this script again to register webhook.\n');
  process.exit(1);
}

const webhookUrl = useSupabase
  ? `${supabaseUrl}/functions/v1/telegram-webhook`
  : `${workerUrl}/api/telegram/webhook`;

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
console.log('\nEnsure TELEGRAM_WEBHOOK_SECRET matches on the Worker (or Supabase secrets if legacy).');
console.log('\nEmployees connect:');
console.log('  1. Open your Malcon Nexus Telegram bot');
console.log('  2. Send: /start EMPLOYEE_CODE');
console.log('  3. Settings → Notifications in app shows status\n');
