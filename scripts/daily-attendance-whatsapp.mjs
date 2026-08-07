#!/usr/bin/env node
/**
 * Daily attendance image → WhatsApp group (office Windows server).
 *
 * Setup (once on server at D:\malcon-nexus):
 *   1. Add to .env:
 *        VITE_SUPABASE_URL=https://your-project.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
 *        ATTENDANCE_WHATSAPP_GROUP_NAME=Your Exact WhatsApp Group Name
 *        ATTENDANCE_WHATSAPP_GROUP_ID=120363012345678901@g.us   (optional — skips getChats)
 *        ATTENDANCE_WHATSAPP_SESSION_PATH=D:\MalconNexus\WhatsAppSession
 *        ATTENDANCE_REPORTS_DIR=D:\MalconNexus\AttendanceReports
 *        ATTENDANCE_REPORT_FILTER=in
 *        ATTENDANCE_REPORT_FILTERS=in,absent   (multiple — noon job)
 *   2. npm install
 *   3. node scripts/daily-attendance-whatsapp.mjs   (scan QR on first run)
 *   4. powershell -ExecutionPolicy Bypass -File scripts/setup-attendance-whatsapp-noon-task.ps1
 *
 * Manual PNG only (no WhatsApp):  node scripts/daily-attendance-whatsapp.mjs --png-only
 * Both in + absent now:           node scripts/daily-attendance-whatsapp.mjs --filters=in,absent
 * List group IDs for .env:         node scripts/daily-attendance-whatsapp.mjs --list-groups
 * Good morning group (daily):      node scripts/daily-attendance-whatsapp.mjs --good-morning-group
 * Good morning DM test (daily):    node scripts/daily-attendance-whatsapp.mjs --good-morning-dm
 * Boss copy test (DM only):       node scripts/daily-attendance-whatsapp.mjs --boss-test
 * Fresh start (delete session):    powershell -ExecutionPolicy Bypass -File scripts/reset-attendance-whatsapp.ps1
 *
 * Good morning group uses GM.png in repo root (override: ATTENDANCE_WHATSAPP_MORNING_IMAGE).
 * Schedule: scripts/setup-good-morning-group-task.ps1  (default 9:00 AM)
 *
 * Good morning DM (.env):
 *   ATTENDANCE_WHATSAPP_DM_PHONE=919876543210          (country code, no +)
 *   ATTENDANCE_WHATSAPP_GOOD_MORNING_TEXT=Good morning!
 * Schedule: scripts/setup-good-morning-dm-task.ps1
 *
 * Also copy daily attendance reports to boss personal WhatsApp (.env):
 *   ATTENDANCE_WHATSAPP_BOSS_PHONE=919876543210        (country code, no +)
 *   ATTENDANCE_WHATSAPP_BOSS_CONTACT=Boss Name         (optional — match saved contact name)
 * When BOSS_PHONE or BOSS_CONTACT is set, the same punched-in / absent images go to the group AND this number.
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/load-env.mjs';
import {
  buildShareListRows,
  formatShareDate,
  formatTimeIST,
  getISTDateKey,
  mapAttendanceRow,
  mapEmployeeRow,
  shareDetailLines,
  shareTitleForFilter,
} from './lib/attendance-report.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

loadEnv();
const envFile = process.env._MALCON_ENV_PATH ?? '(unknown)';

const pngOnly = process.argv.includes('--png-only') || process.env.ATTENDANCE_SKIP_WHATSAPP === '1';
const listGroups = process.argv.includes('--list-groups');
const listDms = process.argv.includes('--list-dms');
const goodMorningDm = process.argv.includes('--good-morning-dm');
const goodMorningGroup = process.argv.includes('--good-morning-group');
const bossTest = process.argv.includes('--boss-test');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const groupName = process.env.ATTENDANCE_WHATSAPP_GROUP_NAME?.trim();
const groupIdEnv = process.env.ATTENDANCE_WHATSAPP_GROUP_ID?.trim();
const dmPhone = process.env.ATTENDANCE_WHATSAPP_DM_PHONE?.trim();
const dmContactName = process.env.ATTENDANCE_WHATSAPP_DM_CONTACT?.trim();
const bossPhone = process.env.ATTENDANCE_WHATSAPP_BOSS_PHONE?.trim();
const bossContactName = process.env.ATTENDANCE_WHATSAPP_BOSS_CONTACT?.trim();
const goodMorningText = process.env.ATTENDANCE_WHATSAPP_GOOD_MORNING_TEXT?.trim()
  ?? 'Good morning! ☀️ Malcon Nexus is online and ready for the day.';
const whatsappWebVersion = process.env.ATTENDANCE_WHATSAPP_WEB_VERSION?.trim() || '2.3000.1017054665';
const sessionPath = process.env.ATTENDANCE_WHATSAPP_SESSION_PATH
  ?? join('D:', 'MalconNexus', 'WhatsAppSession');
const reportsDir = process.env.ATTENDANCE_REPORTS_DIR
  ?? join('D:', 'MalconNexus', 'AttendanceReports');

const VALID_FILTERS = new Set(['in', 'out', 'absent', 'unclosed']);

function parseReportFilters() {
  const filters = [];

  for (const arg of process.argv) {
    if (arg.startsWith('--filters=')) {
      filters.push(...arg.slice('--filters='.length).split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg.startsWith('--filter=')) {
      filters.push(arg.slice('--filter='.length).trim());
    } else if (VALID_FILTERS.has(arg)) {
      // PowerShell splits --filters=in,absent into --filters=in and absent
      filters.push(arg);
    }
  }

  if (filters.length > 0) {
    return [...new Set(filters)];
  }

  const multiEnv = process.env.ATTENDANCE_REPORT_FILTERS?.trim();
  if (multiEnv) {
    return multiEnv.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [(process.env.ATTENDANCE_REPORT_FILTER ?? 'in').trim()];
}

const needsSupabase = !listGroups && !listDms && !goodMorningDm && !goodMorningGroup && !bossTest;

if (needsSupabase && (!supabaseUrl || !supabaseKey)) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (goodMorningDm && !dmPhone && !dmContactName) {
  console.error('Missing ATTENDANCE_WHATSAPP_DM_PHONE or ATTENDANCE_WHATSAPP_DM_CONTACT in .env');
  process.exit(1);
}
if (bossTest && !bossPhone && !bossContactName) {
  console.error('Missing ATTENDANCE_WHATSAPP_BOSS_PHONE or ATTENDANCE_WHATSAPP_BOSS_CONTACT in .env');
  process.exit(1);
}
if ((goodMorningGroup || (!pngOnly && !listGroups && !listDms && !goodMorningDm && !bossTest))
    && !groupName && !groupIdEnv) {
  console.error('Missing ATTENDANCE_WHATSAPP_GROUP_NAME or ATTENDANCE_WHATSAPP_GROUP_ID in .env');
  process.exit(1);
}

function resolveMorningImagePath() {
  const fromEnv = process.env.ATTENDANCE_WHATSAPP_MORNING_IMAGE?.trim();
  const imagePath = fromEnv ? resolve(fromEnv) : join(root, 'GM.png');
  if (!existsSync(imagePath)) {
    throw new Error(`Morning image not found: ${imagePath} (add GM.png to repo root or set ATTENDANCE_WHATSAPP_MORNING_IMAGE)`);
  }
  return imagePath;
}

const sb = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PAGE = 1000;

async function fetchAll(table, orderCol) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .order(orderCol, { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildShareHtml(dateKey, filter, rows) {
  const title = shareTitleForFilter(filter);
  const dateLabel = formatShareDate(dateKey);
  const updated = formatTimeIST(new Date());

  const items = rows.length === 0
    ? '<p class="empty">No one in this list.</p>'
    : `<ol class="grid">${rows.map((row, i) => {
      const details = shareDetailLines(row, filter);
      const detailHtml = details.map((line) => {
        const cls = line.startsWith('Unclosed') ? 'detail unclosed' : 'detail';
        return `<p class="${cls}">${escapeHtml(line)}</p>`;
      }).join('');
      return `<li class="item">
        <p class="name"><span class="num">${i + 1}.</span> ${escapeHtml(row.employeeName)}</p>
        ${detailHtml}
      </li>`;
    }).join('')}</ol>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: #fff;
      color: #111827;
      padding: 20px;
      width: 720px;
    }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 20px;
      background: #fff;
    }
    .brand {
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: #4338ca;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    h1 {
      text-align: center;
      font-size: 16px;
      font-weight: 700;
      margin-top: 4px;
    }
    .date {
      text-align: center;
      font-size: 12px;
      color: #4b5563;
      margin-top: 2px;
    }
    .total {
      text-align: center;
      font-size: 11px;
      color: #6b7280;
      margin: 4px 0 12px;
    }
    .grid {
      list-style: none;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .item {
      border: 1px solid #f3f4f6;
      border-radius: 8px;
      background: rgba(249, 250, 251, 0.5);
      padding: 6px 8px;
      min-width: 0;
    }
    .name {
      font-size: 11px;
      font-weight: 600;
      color: #111827;
      line-height: 1.3;
    }
    .num { color: #9ca3af; font-weight: 700; }
    .detail {
      font-size: 10px;
      color: #4b5563;
      margin-top: 2px;
      line-height: 1.25;
      font-variant-numeric: tabular-nums;
    }
    .detail.unclosed { color: #b45309; font-weight: 600; }
    .empty {
      text-align: center;
      font-size: 14px;
      color: #6b7280;
      padding: 24px 0;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      color: #9ca3af;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #f3f4f6;
    }
  </style>
</head>
<body>
  <div class="card" id="share-list">
    <p class="brand">Malcon Nexus</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="date">${escapeHtml(dateLabel)}</p>
    <p class="total">Total: <strong>${rows.length}</strong></p>
    ${items}
    <p class="footer">Updated ${escapeHtml(updated)} · malcon-nexus-gamma.vercel.app</p>
  </div>
</body>
</html>`;
}

function resolvePuppeteerExecutablePath() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

async function htmlToPng(html, outPath) {
  const puppeteer = await import('puppeteer');
  const launchOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  const executablePath = resolvePuppeteerExecutablePath();
  if (executablePath) {
    launchOpts.executablePath = executablePath;
  }
  const browser = await puppeteer.default.launch(launchOpts);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 760, height: 800, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const el = await page.$('#share-list');
    if (!el) throw new Error('Share list element not found in HTML');
    await el.screenshot({ path: outPath, type: 'png' });
  } finally {
    await browser.close();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeGroupId(id) {
  const trimmed = id.trim();
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@g.us`;
}

function normalizeDmPhone(phone, label = 'phone number') {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    throw new Error(`Invalid ${label}: "${phone}" (use country code, no +)`);
  }
  if (digits.includes('@')) return digits;
  return `${digits}@c.us`;
}

function getBossCopyTarget() {
  if (!bossPhone && !bossContactName) return null;
  return {
    type: 'dm',
    phone: bossPhone || null,
    contactName: bossContactName || null,
    label: bossContactName || `+${(bossPhone ?? '').replace(/\D/g, '')}`,
  };
}

function getAttendanceSendTargets() {
  const targets = [{
    type: 'group',
    label: groupIdEnv || groupName,
  }];
  const boss = getBossCopyTarget();
  if (boss) targets.push(boss);
  return targets;
}

function buildGoodMorningHtml(dateKey, message) {
  const dateLabel = formatShareDate(dateKey);
  const updated = formatTimeIST(new Date());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #fef3c7 0%, #fff 45%, #e0e7ff 100%);
      color: #111827;
      padding: 24px;
      width: 520px;
    }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 20px;
      padding: 28px 24px;
      background: #fff;
      text-align: center;
      box-shadow: 0 10px 30px rgba(67, 56, 202, 0.08);
    }
    .brand {
      font-size: 11px;
      font-weight: 600;
      color: #4338ca;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .sun {
      font-size: 42px;
      margin: 12px 0 8px;
      line-height: 1;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      color: #1f2937;
      line-height: 1.2;
    }
    .date {
      font-size: 13px;
      color: #6b7280;
      margin-top: 8px;
    }
    .message {
      margin-top: 18px;
      font-size: 15px;
      line-height: 1.5;
      color: #374151;
      white-space: pre-wrap;
    }
    .footer {
      font-size: 10px;
      color: #9ca3af;
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid #f3f4f6;
    }
  </style>
</head>
<body>
  <div class="card" id="share-list">
    <p class="brand">Malcon Nexus</p>
    <p class="sun">☀️</p>
    <h1>Good Morning</h1>
    <p class="date">${escapeHtml(dateLabel)}</p>
    <p class="message">${escapeHtml(message)}</p>
    <p class="footer">Test ping · Updated ${escapeHtml(updated)}</p>
  </div>
</body>
</html>`;
}

async function waitForWhatsAppStore(client, timeoutMs = 90_000) {
  if (!client.pupPage) throw new Error('WhatsApp browser page not ready');
  await client.pupPage.waitForFunction(
    () => {
      try {
        const collections = window.require('WAWebCollections');
        return typeof collections?.Chat?.getModelsArray === 'function';
      } catch {
        return false;
      }
    },
    { timeout: timeoutMs },
  );
}

/** Bypass broken client.getChats() — read group ids directly from WhatsApp Web store. */
async function listGroupsFromStore(client, attempts = 3, delayMs = 10_000) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await waitForWhatsAppStore(client);
      const groups = await client.pupPage.evaluate(() => {
        function serializeChatId(id) {
          if (!id) return null;
          if (typeof id === 'string') return id;
          if (typeof id._serialized === 'string') return id._serialized;
          if (typeof id.toString === 'function') {
            const s = id.toString();
            if (s && s.includes('@')) return s;
          }
          if (id.user && id.server) return `${id.user}@${id.server}`;
          return null;
        }
        const chats = window.require('WAWebCollections').Chat.getModelsArray();
        return chats
          .filter((c) => c.groupMetadata)
          .map((c) => ({
            name: (c.formattedTitle || c.name || '').trim(),
            id: serializeChatId(c.id),
          }))
          .filter((g) => g.id && g.name);
      });
      return groups;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[attendance-whatsapp] list groups attempt ${attempt}/${attempts} failed: ${msg}`);
      if (attempt < attempts) {
        console.log(`[attendance-whatsapp] waiting ${delayMs / 1000}s before retry…`);
        await sleep(delayMs);
      }
    }
  }
  throw lastErr;
}

/** List individual (non-group) chats from WhatsApp Web store. */
async function listDmsFromStore(client, attempts = 3, delayMs = 10_000) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await waitForWhatsAppStore(client);
      const dms = await client.pupPage.evaluate(() => {
        function serializeChatId(id) {
          if (!id) return null;
          if (typeof id === 'string') return id;
          if (typeof id._serialized === 'string') return id._serialized;
          if (typeof id.toString === 'function') {
            const s = id.toString();
            if (s && s.includes('@')) return s;
          }
          if (id.user && id.server) return `${id.user}@${id.server}`;
          return null;
        }
        const chats = window.require('WAWebCollections').Chat.getModelsArray();
        return chats
          .filter((c) => !c.groupMetadata)
          .map((c) => ({
            name: (c.formattedTitle || c.name || c.contact?.pushname || '').trim(),
            id: serializeChatId(c.id),
          }))
          .filter((c) => c.id && c.id.endsWith('@c.us'));
      });
      return dms;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[attendance-whatsapp] list DMs attempt ${attempt}/${attempts} failed: ${msg}`);
      if (attempt < attempts) {
        console.log(`[attendance-whatsapp] waiting ${delayMs / 1000}s before retry…`);
        await sleep(delayMs);
      }
    }
  }
  throw lastErr;
}

async function resolveDmChatId(client, options = {}) {
  const useGlobalFallback = options.useGlobalFallback !== false;
  const phone = options.phone ?? (useGlobalFallback ? dmPhone : null);
  const contactName = options.contactName ?? (useGlobalFallback ? dmContactName : null);

  await waitForWhatsAppStore(client);

  if (contactName) {
    const dms = await listDmsFromStore(client, 1, 0);
    const target = contactName.trim().toLowerCase();
    const match = dms.find((c) => c.name.trim().toLowerCase() === target);
    if (!match) {
      const names = dms.map((c) => c.name).filter(Boolean).slice(0, 25);
      throw new Error(
        `WhatsApp contact not found: "${contactName}". Chats seen: ${names.join(', ') || '(none)'}. `
        + 'Run: node scripts\\daily-attendance-whatsapp.mjs --list-dms',
      );
    }
    console.log(`[attendance-whatsapp] matched contact "${match.name}" → ${match.id}`);
    return match.id;
  }

  if (!phone) {
    throw new Error('Missing phone or contact name for WhatsApp DM target.');
  }

  const chatId = normalizeDmPhone(phone, 'ATTENDANCE_WHATSAPP phone');
  const existsInStore = await client.pupPage.evaluate((targetChatId) => {
    function serializeChatId(id) {
      if (!id) return null;
      if (typeof id === 'string') return id;
      if (typeof id._serialized === 'string') return id._serialized;
      if (typeof id.toString === 'function') {
        const s = id.toString();
        if (s && s.includes('@')) return s;
      }
      if (id.user && id.server) return `${id.user}@${id.server}`;
      return null;
    }
    const chats = window.require('WAWebCollections').Chat.getModelsArray();
    return chats.some((c) => !c.groupMetadata && serializeChatId(c.id) === targetChatId);
  }, chatId);

  if (existsInStore) {
    console.log(`[attendance-whatsapp] using phone (${chatId})`);
    return chatId;
  }

  const digits = phone.replace(/\D/g, '');
  console.log(`[attendance-whatsapp] no existing chat for +${digits} — checking WhatsApp…`);
  const numberId = await client.getNumberId(digits);
  if (!numberId) {
    throw new Error(
      `Phone +${digits} is not on WhatsApp or is blocked. `
      + 'Message this number once from the linked phone, then retry.',
    );
  }
  const resolved = numberId._serialized ?? `${digits}@c.us`;
  console.log(`[attendance-whatsapp] resolved DM target → ${resolved}`);
  return resolved;
}

async function resolveGroupChatId(client) {
  if (groupIdEnv) {
    const id = normalizeGroupId(groupIdEnv);
    console.log(`[attendance-whatsapp] using ATTENDANCE_WHATSAPP_GROUP_ID (${id})`);
    return id;
  }

  const groups = await listGroupsFromStore(client);
  const target = groupName.trim().toLowerCase();
  const group = groups.find((g) => g.name.trim().toLowerCase() === target);
  if (!group) {
    const names = groups.map((g) => g.name).slice(0, 25);
    throw new Error(
      `WhatsApp group not found: "${groupName}". Groups seen: ${names.join(', ') || '(none)'}. `
      + 'Run: node scripts\\daily-attendance-whatsapp.mjs --list-groups '
      + 'then set ATTENDANCE_WHATSAPP_GROUP_ID in .env',
    );
  }
  console.log(`[attendance-whatsapp] matched group "${group.name}" → ${group.id}`);
  return group.id;
}

function buildWhatsAppClient(LocalAuth, Client) {
  mkdirSync(sessionPath, { recursive: true });

  const headless = process.env.ATTENDANCE_WHATSAPP_HEADLESS !== '0';

  const puppeteerOpts = {
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  };
  const executablePath = resolvePuppeteerExecutablePath();
  if (executablePath) {
    puppeteerOpts.executablePath = executablePath;
  }

  return new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    webVersion: whatsappWebVersion,
    webVersionCache: {
      type: 'remote',
      remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${whatsappWebVersion}.html`,
    },
    puppeteer: puppeteerOpts,
  });
}

async function connectWhatsAppClient() {
  const { default: qrcode } = await import('qrcode-terminal');
  const wweb = await import('whatsapp-web.js');
  const { Client, LocalAuth, MessageMedia } = wweb.default ?? wweb;

  const client = buildWhatsAppClient(LocalAuth, Client);
  const readyTimeoutMs = 180_000;

  client.on('qr', (qr) => {
    console.log('\nScan this QR with WhatsApp → Linked devices → Link a device:\n');
    qrcode.generate(qr, { small: true });
    console.log('[attendance-whatsapp] waiting for scan… (do not close this window)\n');
  });

  client.on('authenticated', () => {
    console.log('[attendance-whatsapp] phone linked — loading WhatsApp Web (can take 1–2 min)…');
  });

  client.on('loading_screen', (percent, message) => {
    console.log(`[attendance-whatsapp] loading ${percent}%${message ? ` — ${message}` : ''}`);
  });

  client.on('change_state', (state) => {
    console.log(`[attendance-whatsapp] state: ${state}`);
  });

  await new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(
        'WhatsApp did not finish loading within 3 minutes after scan. '
        + 'Phone shows linked but PC is stuck — press Ctrl+C, run reset script, and try again. '
        + 'Or set ATTENDANCE_WHATSAPP_HEADLESS=0 in .env to see the browser window.',
      ));
    }, readyTimeoutMs);

    const done = () => {
      clearTimeout(timeout);
      resolvePromise();
    };

    client.on('ready', done);
    client.on('auth_failure', (msg) => {
      clearTimeout(timeout);
      reject(new Error(`WhatsApp auth failed: ${msg}`));
    });
    client.initialize().catch((err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  console.log('[attendance-whatsapp] WhatsApp ready — waiting 10s for chat store to sync…');
  await sleep(10_000);

  return { client, MessageMedia };
}

function logConnectedAccount(client) {
  const info = client.info;
  const phone = info?.wid?.user;
  const name = info?.pushname?.trim();
  if (phone) {
    console.log(`[attendance-whatsapp] logged in as +${phone}${name ? ` (${name})` : ''}`);
    console.log('[attendance-whatsapp] check this is the same phone you use to view the group');
  }
}

async function getChatSnapshot(client, chatId) {
  return client.pupPage.evaluate((targetChatId) => {
    function serializeChatId(id) {
      if (!id) return null;
      if (typeof id === 'string') return id;
      if (typeof id._serialized === 'string') return id._serialized;
      if (typeof id.toString === 'function') {
        const s = id.toString();
        if (s && s.includes('@')) return s;
      }
      if (id.user && id.server) return `${id.user}@${id.server}`;
      return null;
    }

    const chats = window.require('WAWebCollections').Chat.getModelsArray();
    const chat = chats.find((c) => serializeChatId(c.id) === targetChatId);
    if (!chat) return null;

    const msgs = chat.msgs?.getModelsArray?.() ?? [];
    const mine = msgs.filter((m) => m.id?.fromMe || m.fromMe);
    const last = mine[mine.length - 1];
    return {
      count: mine.length,
      lastTs: last?.t ?? 0,
      lastCaption: (last?.caption ?? last?.body ?? '').trim(),
    };
  }, chatId);
}

async function waitForChatDelivery(client, chatId, before, caption, timeoutMs = 90_000) {
  const captionNeedle = caption.slice(0, 30);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const after = await getChatSnapshot(client, chatId);
    if (after && (after.count > before.count || after.lastTs > before.lastTs)) {
      if (!captionNeedle || after.lastCaption.includes(captionNeedle) || after.lastCaption.includes('Malcon Nexus')) {
        return true;
      }
      // New outgoing message with different caption still counts as delivered
      if (after.lastTs > before.lastTs) return true;
    }
    await sleep(2000);
  }
  return false;
}

/**
 * Fire one store send, then confirm in chat — never use a second send method.
 * (client.sendMessage often returns null even when the image was delivered.)
 */
async function attemptStoreSend(client, targetChatId, media, caption, lookupName = null) {
  await client.pupPage.evaluate(
    async ({ chatId, chatName, mediaPayload, captionText }) => {
      function serializeChatId(id) {
        if (!id) return null;
        if (typeof id === 'string') return id;
        if (typeof id._serialized === 'string') return id._serialized;
        if (typeof id.toString === 'function') {
          const s = id.toString();
          if (s && s.includes('@')) return s;
        }
        if (id.user && id.server) return `${id.user}@${id.server}`;
        return null;
      }

      const chats = window.require('WAWebCollections').Chat.getModelsArray();
      let chat = chats.find((c) => serializeChatId(c.id) === chatId);
      if (!chat && chatName) {
        const target = chatName.trim().toLowerCase();
        chat = chats.find(
          (c) => (c.formattedTitle || c.name || '').trim().toLowerCase() === target,
        );
      }
      if (!chat) throw new Error(`Chat not found: ${chatId || chatName}`);

      await window.WWebJS.sendMessage(chat, '', {
        media: mediaPayload,
        caption: captionText,
        waitUntilMsgSent: true,
      });
    },
    {
      chatId: targetChatId,
      chatName: lookupName,
      mediaPayload: {
        mimetype: media.mimetype,
        data: media.data,
        filename: media.filename || 'attendance.png',
      },
      captionText: caption,
    },
  );
}

async function sendOneImageOnce(client, targetChatId, media, caption, label, lookupName = null) {
  let before = await getChatSnapshot(client, targetChatId);
  if (!before) {
    console.log(`[attendance-whatsapp] ${label} chat not in store yet — sending to ${targetChatId}…`);
    before = { count: 0, lastTs: 0, lastCaption: '' };
  }

  let usedFallback = false;
  try {
    await attemptStoreSend(client, targetChatId, media, caption, lookupName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[attendance-whatsapp] ${label} store send failed: ${msg}`);
    console.log(`[attendance-whatsapp] ${label} trying sendMessage fallback…`);
    await client.sendMessage(targetChatId, media, { caption });
    usedFallback = true;
    console.log(`[attendance-whatsapp] ${label} sendMessage fallback OK`);
  }

  console.log(`[attendance-whatsapp] ${label} waiting for message in chat…`);
  const delivered = await waitForChatDelivery(client, targetChatId, before, caption);
  if (delivered) {
    console.log(`[attendance-whatsapp] ${label} confirmed ✓`);
    return;
  }

  if (usedFallback) {
    console.warn(`[attendance-whatsapp] ${label} fallback send done — confirmation skipped`);
    return;
  }

  throw new Error(`Failed to send ${label} — message not seen in chat`);
}

async function sendWhatsAppBatchToTargets(items, targets) {
  console.log(
    `[attendance-whatsapp] sending ${items.length} image(s) to ${targets.length} destination(s): `
    + `${targets.map((t) => `"${t.label}"`).join(', ')}…`,
  );

  const { client, MessageMedia } = await connectWhatsAppClient();
  try {
    logConnectedAccount(client);

    for (let t = 0; t < targets.length; t += 1) {
      const target = targets[t];
      const targetChatId = target.type === 'group'
        ? await resolveGroupChatId(client)
        : await resolveDmChatId(client, {
          phone: target.phone ?? undefined,
          contactName: target.contactName ?? undefined,
          useGlobalFallback: false,
        });

      console.log(`[attendance-whatsapp] → ${target.label}`);

      for (let i = 0; i < items.length; i += 1) {
        const { pngPath, caption, filter } = items[i];
        const media = MessageMedia.fromFilePath(pngPath);
        const sizeKb = Math.round((media.data?.length ?? 0) * 0.75 / 1024);
        console.log(`[attendance-whatsapp] [${i + 1}/${items.length}] ${filter} — ${sizeKb}KB…`);
        await sendOneImageOnce(
          client,
          targetChatId,
          media,
          caption,
          `${target.label}:${filter}`,
          target.contactName || null,
        );

        if (i < items.length - 1) {
          console.log('[attendance-whatsapp] waiting 12s before next image…');
          await sleep(12_000);
        }
      }

      if (t < targets.length - 1) {
        console.log('[attendance-whatsapp] waiting 8s before next destination…');
        await sleep(8_000);
      }
    }
  } finally {
    await client.destroy();
  }
}

async function sendWhatsAppBatch(items) {
  await sendWhatsAppBatchToTargets(items, [{
    type: 'group',
    label: groupIdEnv || groupName,
  }]);
}

async function sendWhatsAppDm(pngPath, caption) {
  const targetLabel = dmContactName || `+${dmPhone.replace(/\D/g, '')}`;
  console.log(`[attendance-whatsapp] sending DM image to "${targetLabel}"…`);

  const { client, MessageMedia } = await connectWhatsAppClient();
  try {
    logConnectedAccount(client);
    const targetChatId = await resolveDmChatId(client);
    const media = MessageMedia.fromFilePath(pngPath);
    const sizeKb = Math.round((media.data?.length ?? 0) * 0.75 / 1024);
    console.log(`[attendance-whatsapp] good-morning — ${sizeKb}KB…`);
    await sendOneImageOnce(client, targetChatId, media, caption, 'good-morning', dmContactName || null);
  } finally {
    await client.destroy();
  }
}

async function listGroupsCommand() {
  const { client } = await connectWhatsAppClient();
  try {
    const groups = await listGroupsFromStore(client);
    console.log('\n=== WhatsApp groups (copy id into ATTENDANCE_WHATSAPP_GROUP_ID) ===\n');
    if (groups.length === 0) {
      console.log('No groups found.');
      return;
    }
    for (const g of groups.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`${g.name}\n  → ${g.id}\n`);
    }
  } finally {
    await client.destroy();
  }
}

async function listDmsCommand() {
  const { client } = await connectWhatsAppClient();
  try {
    const dms = await listDmsFromStore(client);
    console.log('\n=== WhatsApp DMs (copy phone digits into ATTENDANCE_WHATSAPP_DM_PHONE or ATTENDANCE_WHATSAPP_BOSS_PHONE) ===\n');
    if (dms.length === 0) {
      console.log('No individual chats found.');
      return;
    }
    for (const c of dms.sort((a, b) => a.name.localeCompare(b.name))) {
      const phone = c.id.replace('@c.us', '');
      console.log(`${c.name || '(no name)'}\n  phone: ${phone}\n  id: ${c.id}\n`);
    }
  } finally {
    await client.destroy();
  }
}

function goodMorningLogPath(mode) {
  return join(reportsDir, mode === 'group' ? '_good-morning-group.log' : '_good-morning-dm.log');
}

async function goodMorningDmMain() {
  const started = Date.now();
  const dateKey = getISTDateKey();
  console.log(`[attendance-whatsapp] good-morning DM date=${dateKey}`);

  mkdirSync(reportsDir, { recursive: true });

  const html = buildGoodMorningHtml(dateKey, goodMorningText);
  const pngPath = join(reportsDir, `malcon-good-morning-${dateKey}.png`);
  await htmlToPng(html, pngPath);
  console.log(`[attendance-whatsapp] PNG saved: ${pngPath}`);

  const caption = `Malcon Nexus · Good morning · ${formatShareDate(dateKey)}`;
  const logPath = goodMorningLogPath('dm');

  if (pngOnly) {
    console.log('[attendance-whatsapp] --png-only: skipped WhatsApp DM send');
  } else {
    await sendWhatsAppDm(pngPath, caption);
    console.log('[attendance-whatsapp] sent good-morning image via WhatsApp DM');
    writeFileSync(
      logPath,
      `[${new Date().toISOString()}] OK date=${dateKey} png=${pngPath} to=${dmContactName || dmPhone}\n`,
      { flag: 'a' },
    );
  }

  console.log(`[attendance-whatsapp] done in ${Math.round((Date.now() - started) / 1000)}s`);
}

async function goodMorningGroupMain() {
  const started = Date.now();
  const dateKey = getISTDateKey();
  const imagePath = resolveMorningImagePath();
  console.log(`[attendance-whatsapp] good-morning group date=${dateKey} image=${imagePath}`);

  mkdirSync(reportsDir, { recursive: true });

  const caption = `${goodMorningText} · ${formatShareDate(dateKey)}`;
  const sendItems = [{ filter: 'good-morning', pngPath: imagePath, caption }];
  const logPath = goodMorningLogPath('group');

  if (pngOnly) {
    console.log('[attendance-whatsapp] --png-only: skipped WhatsApp group send');
  } else {
    await sendWhatsAppBatch(sendItems);
    console.log('[attendance-whatsapp] sent good-morning image to WhatsApp group');
    writeFileSync(
      logPath,
      `[${new Date().toISOString()}] OK date=${dateKey} png=${imagePath} group=${groupIdEnv || groupName}\n`,
      { flag: 'a' },
    );
  }

  console.log(`[attendance-whatsapp] done in ${Math.round((Date.now() - started) / 1000)}s`);
}

async function bossTestMain() {
  const boss = getBossCopyTarget();
  if (!boss) {
    throw new Error('Set ATTENDANCE_WHATSAPP_BOSS_PHONE or ATTENDANCE_WHATSAPP_BOSS_CONTACT in .env');
  }

  const started = Date.now();
  const dateKey = getISTDateKey();
  console.log(`[attendance-whatsapp] boss-test date=${dateKey} target=${boss.label}`);

  mkdirSync(reportsDir, { recursive: true });
  const html = buildGoodMorningHtml(dateKey, 'Boss copy test — if you see this, personal DM works.');
  const pngPath = join(reportsDir, `malcon-boss-test-${dateKey}.png`);
  await htmlToPng(html, pngPath);
  console.log(`[attendance-whatsapp] PNG saved: ${pngPath}`);

  const caption = `Malcon Nexus · Boss copy test · ${formatShareDate(dateKey)}`;
  await sendWhatsAppBatchToTargets([{ filter: 'boss-test', pngPath, caption }], [boss]);
  console.log(`[attendance-whatsapp] boss test sent to ${boss.label}`);
  console.log(`[attendance-whatsapp] done in ${Math.round((Date.now() - started) / 1000)}s`);
}

async function main() {
  if (listGroups) {
    await listGroupsCommand();
    return;
  }

  if (listDms) {
    await listDmsCommand();
    return;
  }

  if (goodMorningDm) {
    await goodMorningDmMain();
    return;
  }

  if (goodMorningGroup) {
    await goodMorningGroupMain();
    return;
  }

  if (bossTest) {
    await bossTestMain();
    return;
  }

  const filters = parseReportFilters();
  for (const filter of filters) {
    if (!VALID_FILTERS.has(filter)) {
      throw new Error(`Invalid filter "${filter}". Use: in, out, absent, unclosed`);
    }
  }

  const started = Date.now();
  const dateKey = getISTDateKey();
  const targets = getAttendanceSendTargets();
  console.log(`[attendance-whatsapp] date=${dateKey} filters=${filters.join(',')}`);
  console.log(`[attendance-whatsapp] destinations: ${targets.map((t) => t.label).join(' + ')}`);
  if (!getBossCopyTarget()) {
    console.warn('[attendance-whatsapp] boss copy OFF — add ATTENDANCE_WHATSAPP_BOSS_PHONE to .env on this PC');
  }

  mkdirSync(reportsDir, { recursive: true });

  const [employeeRows, attendanceRows] = await Promise.all([
    fetchAll('employees', 'name'),
    fetchAll('attendance_records', 'punched_at'),
  ]);

  const employees = employeeRows.map(mapEmployeeRow);
  const records = attendanceRows.map(mapAttendanceRow);

  const sendItems = [];

  for (const filter of filters) {
    const rows = buildShareListRows(employees, records, dateKey, filter);
    console.log(`[attendance-whatsapp] ${filter}: ${rows.length} employees in share list`);

    const html = buildShareHtml(dateKey, filter, rows);
    const pngPath = join(reportsDir, `malcon-attendance-${dateKey}-${filter}.png`);
    await htmlToPng(html, pngPath);
    console.log(`[attendance-whatsapp] PNG saved: ${pngPath}`);

    const caption = `Malcon Nexus · ${shareTitleForFilter(filter)} · ${formatShareDate(dateKey)} · Total: ${rows.length}`;
    sendItems.push({ filter, pngPath, caption, count: rows.length });

    const logLine = `[${new Date().toISOString()}] OK date=${dateKey} filter=${filter} count=${rows.length} png=${pngPath} destinations=${targets.map((t) => t.label).join('+')}\n`;
    writeFileSync(join(reportsDir, '_whatsapp-task.log'), logLine, { flag: 'a' });
  }

  if (pngOnly) {
    console.log('[attendance-whatsapp] --png-only: skipped WhatsApp send');
  } else {
    await sendWhatsAppBatchToTargets(sendItems, targets);
    const destSummary = targets.map((t) => t.label).join(' + ');
    console.log(`[attendance-whatsapp] sent ${sendItems.length} image(s) to ${destSummary}`);
  }

  console.log(`[attendance-whatsapp] done in ${Math.round((Date.now() - started) / 1000)}s`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error('[attendance-whatsapp] FAILED:', msg);
  try {
    const reports = process.env.ATTENDANCE_REPORTS_DIR ?? join('D:', 'MalconNexus', 'AttendanceReports');
    mkdirSync(reports, { recursive: true });
    const logFile = goodMorningGroup
      ? join(reports, '_good-morning-group.log')
      : goodMorningDm
        ? join(reports, '_good-morning-dm.log')
        : join(reports, '_whatsapp-task.log');
    writeFileSync(
      logFile,
      `[${new Date().toISOString()}] ERROR ${msg}\n`,
      { flag: 'a' },
    );
  } catch {
    // ignore log write failure
  }
  process.exit(1);
});
