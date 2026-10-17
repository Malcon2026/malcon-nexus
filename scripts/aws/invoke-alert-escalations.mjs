#!/usr/bin/env node
/**
 * Call POST /api/case-alerts/process (3h Telegram reminders).
 * Schedule every 5–15 minutes via EventBridge → API Gateway or cron on a bastion.
 *
 *   ALERT_CRON_SECRET=... VITE_WORKER_API_URL=https://... node scripts/aws/invoke-alert-escalations.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function loadEnvFile(relativePath) {
  const p = resolve(root, relativePath);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    if (!process.env[key]) {
      process.env[key] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
}

loadEnvFile('.env.production.aws');
loadEnvFile('.env.local');

const base = (process.env.VITE_WORKER_API_URL || process.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const secret = process.env.ALERT_CRON_SECRET || '';

if (!base) {
  console.error('Set VITE_WORKER_API_URL or VITE_API_BASE_URL');
  process.exit(1);
}

const res = await fetch(`${base}/api/case-alerts/process`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(secret ? { 'x-cron-secret': secret } : {}),
  },
  body: '{}',
});

const text = await res.text();
console.log(res.status, text);
