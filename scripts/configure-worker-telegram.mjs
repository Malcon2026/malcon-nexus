#!/usr/bin/env node
/**
 * Configure Telegram on production Worker:
 * - TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET (from env or .env.telegram.local)
 * - Register webhook on Worker URL
 * - Sync telegram_chat_id from Supabase → D1
 *
 * Bot token is NOT retrievable from Supabase Management API (hashes only).
 * Create `.env.telegram.local` (gitignored) with:
 *   TELEGRAM_BOT_TOKEN=123456789:ABC...   (from @BotFather → /mybots → API Token)
 *   TELEGRAM_WEBHOOK_SECRET=random-string   (optional; same as Supabase if migrating)
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const workerDir = resolve(root, 'worker');
const WORKER_URL = 'https://malcon-nexus-api.malcon-nexus.workers.dev';

function loadTelegramEnv() {
  const env = { ...process.env };
  const paths = [
    resolve(root, '.env.telegram.local'),
    resolve(process.env.HOME || '', '.malcon', 'telegram.env'),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
    break;
  }
  return env;
}

function assertBotToken(token) {
  const t = token?.trim() ?? '';
  if (!t.includes(':') || t.length < 40 || t.length > 120) {
    throw new Error(
      'Invalid TELEGRAM_BOT_TOKEN. Add real token to .env.telegram.local (from @BotFather → /mybots → Malcon Nexus → API Token).',
    );
  }
  return t;
}

function wranglerSecret(name, value, envName = 'production') {
  const r = spawnSync('npx', ['wrangler', 'secret', 'put', name, '--env', envName], {
    cwd: workerDir,
    input: value,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error(`wrangler secret put ${name} failed: ${r.stderr || r.stdout}`);
  }
}

async function registerWebhook(botToken, webhookSecret) {
  const webhookUrl = `${WORKER_URL}/api/telegram/webhook`;
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
  if (!body.ok) throw new Error(`setWebhook failed: ${body.description ?? JSON.stringify(body)}`);
  console.log(`✓ Webhook → ${webhookUrl}`);
}

async function main() {
  const env = loadTelegramEnv();
  const botToken = assertBotToken(env.TELEGRAM_BOT_TOKEN);
  const webhookSecret =
    env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
    execFileSync('openssl', ['rand', '-hex', '16'], { encoding: 'utf8' }).trim();

  console.log('Configuring Telegram on Cloudflare Worker…\n');

  wranglerSecret('TELEGRAM_BOT_TOKEN', botToken);
  console.log('✓ TELEGRAM_BOT_TOKEN on Worker');
  wranglerSecret('TELEGRAM_WEBHOOK_SECRET', webhookSecret);
  console.log('✓ TELEGRAM_WEBHOOK_SECRET on Worker');

  await registerWebhook(botToken, webhookSecret);

  execFileSync('node', ['scripts/sync-telegram-chat-ids-to-d1.mjs'], { cwd: root, stdio: 'inherit' });

  const me = await fetch(`https://api.telegram.org/bot${botToken}/getMe`).then((r) => r.json());
  if (me.ok) console.log(`✓ Bot: @${me.result.username}`);
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
