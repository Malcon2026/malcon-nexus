/**
 * Local-only Phase 9.1 notification read validation.
 */
import { sbNotificationRepo } from '../lib/database/repositories/supabaseRepositories';
import { USE_WORKER_NOTIFICATION_READS, WORKER_API_URL } from '../lib/workerReadConfig';

type NetEntry = { url: string; method: string };

const netLog: NetEntry[] = [];
const nativeFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  netLog.push({ url, method: init?.method ?? 'GET' });
  return nativeFetch(input, init);
}) as typeof fetch;

function log(line: string) {
  const el = document.getElementById('log');
  if (el) el.textContent += `${line}\n`;
}

function isSupabaseNotifications(url: string): boolean {
  return /supabase\.co\/rest\/v1\/notifications/i.test(url);
}

function isWorkerNotifications(url: string): boolean {
  return /\/api\/notifications/i.test(url) && /localhost|127\.0\.0\.1/.test(url);
}

export interface NotificationHarnessResult {
  ok: boolean;
  useWorkerNotificationReads: boolean;
  workerApiUrl: string;
  adminListCount: number;
  workerNotificationReads: number;
  supabaseNotificationReads: number;
  duplicateNotificationRead: boolean;
  error?: string;
}

async function run(): Promise<NotificationHarnessResult> {
  netLog.length = 0;
  const result: NotificationHarnessResult = {
    ok: false,
    useWorkerNotificationReads: USE_WORKER_NOTIFICATION_READS,
    workerApiUrl: WORKER_API_URL,
    adminListCount: 0,
    workerNotificationReads: 0,
    supabaseNotificationReads: 0,
    duplicateNotificationRead: false,
  };

  try {
    const list = await sbNotificationRepo.getAll();
    result.adminListCount = list.length;
    result.supabaseNotificationReads = netLog.filter((n) => isSupabaseNotifications(n.url)).length;
    result.workerNotificationReads = netLog.filter((n) => isWorkerNotifications(n.url)).length;
    result.duplicateNotificationRead =
      result.supabaseNotificationReads > 0 && result.workerNotificationReads > 0;

    if (USE_WORKER_NOTIFICATION_READS) {
      result.ok =
        result.adminListCount > 0 &&
        result.workerNotificationReads > 0 &&
        result.supabaseNotificationReads === 0 &&
        !result.duplicateNotificationRead;
    } else {
      result.ok =
        result.adminListCount > 0 &&
        result.workerNotificationReads === 0 &&
        result.supabaseNotificationReads > 0;
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }

  return result;
}

async function main() {
  const status = document.getElementById('status');
  log(`VITE_USE_WORKER_NOTIFICATION_READS=${USE_WORKER_NOTIFICATION_READS}`);
  log(`WORKER_API_URL=${WORKER_API_URL}`);
  const result = await run();
  log(JSON.stringify(result, null, 2));
  (window as unknown as { __PHASE91_NOTIFICATION_HARNESS__?: NotificationHarnessResult }).__PHASE91_NOTIFICATION_HARNESS__ =
    result;
  if (status) {
    status.textContent = result.ok ? 'PASS' : 'FAIL';
    status.className = result.ok ? 'pass' : 'fail';
  }
}

void main();
