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
 *   2. npm install
 *   3. node scripts/daily-attendance-whatsapp.mjs   (scan QR on first run)
 *   4. powershell -ExecutionPolicy Bypass -File scripts/setup-attendance-whatsapp-task.ps1
 *
 * Manual PNG only (no WhatsApp):  node scripts/daily-attendance-whatsapp.mjs --png-only
 */

import {
  mkdirSync,
  existsSync,
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

const pngOnly = process.argv.includes('--png-only') || process.env.ATTENDANCE_SKIP_WHATSAPP === '1';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const groupName = process.env.ATTENDANCE_WHATSAPP_GROUP_NAME?.trim();
const groupIdEnv = process.env.ATTENDANCE_WHATSAPP_GROUP_ID?.trim();
const whatsappWebVersion = process.env.ATTENDANCE_WHATSAPP_WEB_VERSION?.trim() || '2.3000.1017054665';
const sessionPath = process.env.ATTENDANCE_WHATSAPP_SESSION_PATH
  ?? join('D:', 'MalconNexus', 'WhatsAppSession');
const reportsDir = process.env.ATTENDANCE_REPORTS_DIR
  ?? join('D:', 'MalconNexus', 'AttendanceReports');
const filterStatus = (process.env.ATTENDANCE_REPORT_FILTER ?? 'in').trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (!pngOnly && !groupName && !groupIdEnv) {
  console.error('Missing ATTENDANCE_WHATSAPP_GROUP_NAME or ATTENDANCE_WHATSAPP_GROUP_ID in .env');
  process.exit(1);
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

async function htmlToPng(html, outPath) {
  const puppeteer = await import('puppeteer');
  const launchOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
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

async function waitForWWebJS(client, timeoutMs = 90_000) {
  if (!client.pupPage) throw new Error('WhatsApp browser page not ready');
  await client.pupPage.waitForFunction(
    () => typeof window.WWebJS !== 'undefined'
      && typeof window.WWebJS.getChats === 'function',
    { timeout: timeoutMs },
  );
}

async function getChatsWithRetry(client, attempts = 3, delayMs = 10_000) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await waitForWWebJS(client);
      return await client.getChats();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[attendance-whatsapp] getChats attempt ${attempt}/${attempts} failed: ${msg}`);
      if (attempt < attempts) {
        console.log(`[attendance-whatsapp] waiting ${delayMs / 1000}s before retry…`);
        await sleep(delayMs);
      }
    }
  }
  throw lastErr;
}

async function resolveGroupChatId(client) {
  if (groupIdEnv) {
    const id = normalizeGroupId(groupIdEnv);
    console.log(`[attendance-whatsapp] using ATTENDANCE_WHATSAPP_GROUP_ID (${id})`);
    return id;
  }

  const chats = await getChatsWithRetry(client);
  const group = chats.find(
    (c) => c.isGroup && c.name.trim().toLowerCase() === groupName.trim().toLowerCase(),
  );
  if (!group) {
    const groupNames = chats.filter((c) => c.isGroup).map((c) => c.name).slice(0, 20);
    throw new Error(
      `WhatsApp group not found: "${groupName}". Groups seen: ${groupNames.join(', ') || '(none)'}. `
      + 'Tip: set ATTENDANCE_WHATSAPP_GROUP_ID in .env to skip getChats.',
    );
  }
  console.log(`[attendance-whatsapp] matched group "${group.name}" → ${group.id._serialized}`);
  return group.id._serialized;
}

function buildWhatsAppClient(LocalAuth) {
  mkdirSync(sessionPath, { recursive: true });

  const puppeteerOpts = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
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

async function sendWhatsAppImage(pngPath, caption) {
  const { default: qrcode } = await import('qrcode-terminal');
  const wweb = await import('whatsapp-web.js');
  const { Client, LocalAuth, MessageMedia } = wweb.default ?? wweb;

  const client = buildWhatsAppClient(LocalAuth);

  client.on('qr', (qr) => {
    console.log('\nScan this QR with WhatsApp → Linked devices → Link a device:\n');
    qrcode.generate(qr, { small: true });
  });

  await new Promise((resolvePromise, reject) => {
    client.on('ready', resolvePromise);
    client.on('auth_failure', (msg) => reject(new Error(`WhatsApp auth failed: ${msg}`)));
    client.initialize().catch(reject);
  });

  console.log('[attendance-whatsapp] WhatsApp ready — waiting 10s for chat store to sync…');
  await sleep(10_000);

  const targetGroupId = await resolveGroupChatId(client);
  const media = MessageMedia.fromFilePath(pngPath);
  await client.sendMessage(targetGroupId, media, { caption });
  await client.destroy();
}

async function main() {
  const started = Date.now();
  const dateKey = getISTDateKey();
  console.log(`[attendance-whatsapp] date=${dateKey} filter=${filterStatus}`);

  mkdirSync(reportsDir, { recursive: true });

  const [employeeRows, attendanceRows] = await Promise.all([
    fetchAll('employees', 'name'),
    fetchAll('attendance_records', 'punched_at'),
  ]);

  const employees = employeeRows.map(mapEmployeeRow);
  const records = attendanceRows.map(mapAttendanceRow);
  const rows = buildShareListRows(employees, records, dateKey, filterStatus);

  console.log(`[attendance-whatsapp] ${rows.length} employees in share list`);

  const html = buildShareHtml(dateKey, filterStatus, rows);
  const pngPath = join(reportsDir, `malcon-attendance-${dateKey}-${filterStatus}.png`);
  await htmlToPng(html, pngPath);
  console.log(`[attendance-whatsapp] PNG saved: ${pngPath}`);

  const caption = `Malcon Nexus · ${shareTitleForFilter(filterStatus)} · ${formatShareDate(dateKey)} · Total: ${rows.length}`;

  if (pngOnly) {
    console.log('[attendance-whatsapp] --png-only: skipped WhatsApp send');
  } else {
    const targetLabel = groupIdEnv ? groupIdEnv : groupName;
    console.log(`[attendance-whatsapp] sending to group "${targetLabel}"…`);
    await sendWhatsAppImage(pngPath, caption);
    console.log('[attendance-whatsapp] sent to WhatsApp group');
  }

  const logLine = `[${new Date().toISOString()}] OK date=${dateKey} filter=${filterStatus} count=${rows.length} png=${pngPath}\n`;
  writeFileSync(join(reportsDir, '_whatsapp-task.log'), logLine, { flag: 'a' });

  console.log(`[attendance-whatsapp] done in ${Math.round((Date.now() - started) / 1000)}s`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error('[attendance-whatsapp] FAILED:', msg);
  try {
    const reports = process.env.ATTENDANCE_REPORTS_DIR ?? join('D:', 'MalconNexus', 'AttendanceReports');
    mkdirSync(reports, { recursive: true });
    writeFileSync(
      join(reports, '_whatsapp-task.log'),
      `[${new Date().toISOString()}] ERROR ${msg}\n`,
      { flag: 'a' },
    );
  } catch {
    // ignore log write failure
  }
  process.exit(1);
});
