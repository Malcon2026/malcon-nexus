#!/usr/bin/env node
/** Phase 9.4 — remaining read harness (Worker mode + failure mode). */
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
    for (const pid of execSync(`lsof -i :${port} -sTCP:LISTEN -t`, { encoding: 'utf8' }).trim().split('\n')) {
      if (pid) process.kill(Number(pid), 'SIGTERM');
    }
  } catch {
    /* empty */
  }
}

async function waitHttp(path) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${SPA_ORIGIN}${path}`)).ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`timeout ${path}`);
}

async function launchBrowser() {
  const puppeteerPath = resolve(root, 'scripts/node_modules/puppeteer/lib/cjs/puppeteer/puppeteer.js');
  const puppeteer = existsSync(puppeteerPath) ? await import(puppeteerPath) : await import('puppeteer');
  const opts = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  if (process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) {
    opts.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  return puppeteer.launch(opts);
}

async function runHarness(env, workerUrl) {
  stopPort(SPA_PORT);
  await new Promise((r) => setTimeout(r, 800));
  const vite = spawn('npm', ['run', 'dev', '--', '--port', String(SPA_PORT), '--strictPort'], {
    cwd: root,
    env: {
      ...process.env,
      ...env,
      VITE_WORKER_API_URL: workerUrl,
      VITE_USE_WORKER_NOTIFICATION_READS: 'false',
      VITE_USE_WORKER_REFERENCE_READS: 'false',
      VITE_USE_WORKER_OPERATIONS_READS: 'false',
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key',
    },
    stdio: 'ignore',
  });
  await waitHttp('/phase94-remaining-reads-harness.html');
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(`${SPA_ORIGIN}/phase94-remaining-reads-harness.html`, {
    waitUntil: 'networkidle0',
    timeout: 120000,
  });
  await page.waitForFunction(() => window.__PHASE94_REMAINING_HARNESS__ != null, { timeout: 60000 });
  const result = await page.evaluate(() => window.__PHASE94_REMAINING_HARNESS__);
  await browser.close();
  vite.kill('SIGTERM');
  return result;
}

async function main() {
  const health = await fetch(`${WORKER}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    console.error('Worker not on 8787');
    process.exit(1);
  }

  console.log('SUPABASE_MODE SKIP (402 / placeholder env)');

  await new Promise((r) => setTimeout(r, 1500));
  const wrk = await runHarness(
    { VITE_USE_WORKER_REMAINING_READS: 'true', VITE_USE_WORKER_READS: 'true' },
    WORKER,
  );
  console.log('WORKER_MODE', wrk.ok ? 'PASS' : 'FAIL', JSON.stringify(wrk));

  await new Promise((r) => setTimeout(r, 1500));
  const fail = await runHarness(
    { VITE_USE_WORKER_REMAINING_READS: 'true', VITE_USE_WORKER_READS: 'true' },
    'http://127.0.0.1:59999',
  );
  const failureOk = fail && fail.supabaseReads === 0 && !fail.ok;
  console.log('FAILURE_MODE', failureOk ? 'PASS' : 'FAIL', JSON.stringify(fail));

  process.exitCode = wrk.ok && failureOk ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
