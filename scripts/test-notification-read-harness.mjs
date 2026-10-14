#!/usr/bin/env node
/**
 * Phase 9.1 — notification read harness (Puppeteer + phase91-notification-harness.html).
 * Requires: wrangler dev on 8787; starts fresh Vite per mode.
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPA_PORT = 5173;
const SPA_ORIGIN = `http://localhost:${SPA_PORT}`;
const WORKER = 'http://127.0.0.1:8787';

function stopPort(port) {
  try {
    const pids = execSync(`lsof -i :${port} -sTCP:LISTEN -t`, { encoding: 'utf8' }).trim();
    for (const pid of pids.split('\n').filter(Boolean)) process.kill(Number(pid), 'SIGTERM');
  } catch {
    /* empty */
  }
}

async function waitHttp(path) {
  for (let i = 0; i < 120; i += 1) {
    try {
      const r = await fetch(`${SPA_ORIGIN}${path}`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`timeout ${path}`);
}

async function startVite(env) {
  stopPort(SPA_PORT);
  await new Promise((r) => setTimeout(r, 800));
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(SPA_PORT), '--strictPort'], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'ignore',
  });
  await waitHttp('/phase91-notification-harness.html');
  return child;
}

async function runMode(useWorker, label) {
  const vite = await startVite({
    VITE_USE_WORKER_NOTIFICATION_READS: useWorker ? 'true' : 'false',
    VITE_USE_WORKER_READS: 'false',
    VITE_WORKER_API_URL: WORKER,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key',
  });

  const puppeteerPath = resolve(root, 'scripts/node_modules/puppeteer/lib/cjs/puppeteer/puppeteer.js');
  const puppeteer = existsSync(puppeteerPath) ? await import(puppeteerPath) : await import('puppeteer');
  const launchOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) {
    launchOpts.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();
  await page.goto(`${SPA_ORIGIN}/phase91-notification-harness.html`, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction(() => window.__PHASE91_NOTIFICATION_HARNESS__ != null, { timeout: 60000 });
  const result = await page.evaluate(() => window.__PHASE91_NOTIFICATION_HARNESS__);
  await browser.close();
  vite.kill('SIGTERM');
  console.log(label, result.ok ? 'PASS' : 'FAIL', JSON.stringify(result));
  return result.ok;
}

async function main() {
  const health = await fetch(`${WORKER}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    console.error('Worker not running on 8787');
    process.exit(1);
  }

  const hasSupabase =
    process.env.VITE_SUPABASE_URL &&
    process.env.VITE_SUPABASE_ANON_KEY &&
    !process.env.VITE_SUPABASE_URL.includes('placeholder');

  let supabaseOk = true;
  if (hasSupabase) {
    supabaseOk = await runMode(false, 'SUPABASE_MODE');
    await new Promise((r) => setTimeout(r, 1500));
  } else {
    console.log('SUPABASE_MODE SKIP (no VITE_SUPABASE_* in env — verify manually when project is available)');
  }
  const workerOk = await runMode(true, 'WORKER_MODE');

  stopPort(SPA_PORT);
  const failureOk = await (async () => {
    const vite = await startVite({
      VITE_USE_WORKER_NOTIFICATION_READS: 'true',
      VITE_WORKER_API_URL: 'http://127.0.0.1:59999',
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'placeholder-key',
    });
    const puppeteerPath = resolve(root, 'scripts/node_modules/puppeteer/lib/cjs/puppeteer/puppeteer.js');
    const puppeteer = existsSync(puppeteerPath) ? await import(puppeteerPath) : await import('puppeteer');
    const failLaunch = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    if (process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) {
      failLaunch.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }
    const browser = await puppeteer.launch(failLaunch);
    const page = await browser.newPage();
    await page.goto(`${SPA_ORIGIN}/phase91-notification-harness.html`, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction(() => window.__PHASE91_NOTIFICATION_HARNESS__ != null, { timeout: 30000 }).catch(() => null);
    const result = await page.evaluate(() => window.__PHASE91_NOTIFICATION_HARNESS__ ?? null);
    await browser.close();
    vite.kill('SIGTERM');
    const noFallback = result && result.supabaseNotificationReads === 0 && !result.ok;
    console.log('FAILURE_MODE', noFallback ? 'PASS' : 'FAIL', JSON.stringify(result));
    return noFallback;
  })();

  process.exitCode = supabaseOk && workerOk && failureOk ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
