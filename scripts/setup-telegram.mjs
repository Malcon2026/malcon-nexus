#!/usr/bin/env node
/**
 * One-time Telegram bot setup for Malcon Nexus alerts.
 * Run: node scripts/setup-telegram.mjs
 *
 * Requires in Supabase Edge Function secrets:
 *   TELEGRAM_BOT_TOKEN — from @BotFather
 *   TELEGRAM_WEBHOOK_SECRET — any random string (generated below if missing)
 */
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(resolve(root, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch {
    /* no .env */
  }
  return env;
}

const env = loadEnv();
const botToken = env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET || randomBytes(16).toString('hex');

console.log('\n=== Malcon Nexus Telegram Setup ===\n');

if (!botToken) {
  console.log('1. Create bot: Telegram → @BotFather → /newbot → name: Malcon Nexus');
  console.log('2. Supabase Dashboard → Edge Functions → Secrets:');
  console.log('     TELEGRAM_BOT_TOKEN=<token from BotFather>');
  console.log(`     TELEGRAM_WEBHOOK_SECRET=${webhookSecret}`);
  console.log('3. Run SQL migration: supabase/migrations/add-telegram-chat-id.sql');
  console.log('4. Deploy functions:');
  console.log('     npx supabase functions deploy telegram-webhook --no-verify-jwt');
  console.log('     npx supabase functions deploy send-telegram');
  console.log('5. Run this script again to register webhook.\n');
  process.exit(1);
}

if (!projectRef) {
  console.error('Missing VITE_SUPABASE_URL in .env');
  process.exit(1);
}

const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook`;

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
console.log('\nEnsure TELEGRAM_WEBHOOK_SECRET matches in Supabase secrets.');
console.log('\nEmployees connect:');
console.log('  1. Open https://t.me/Malcon_Nexus_bot');
console.log('  2. Send: /start EMPLOYEE_CODE');
console.log('  3. Settings → Notifications in app shows status\n');
