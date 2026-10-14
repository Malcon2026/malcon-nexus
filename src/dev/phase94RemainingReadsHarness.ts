import {
  sbActivityRepo,
  sbApprovalRepo,
  sbCaseRepo,
  sbCaseTaskRequestRepo,
} from '../lib/database/repositories/supabaseRepositories';
import { USE_WORKER_READS, USE_WORKER_REMAINING_READS, WORKER_API_URL } from '../lib/workerReadConfig';

const DEV_EMPLOYEE = 'a1000001-0001-4001-8001-000000000001';

const netLog: { url: string }[] = [];
const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  netLog.push({ url });
  return nativeFetch(input, init);
}) as typeof fetch;

function log(line: string) {
  const el = document.getElementById('log');
  if (el) el.textContent += `${line}\n`;
}

function supabaseRemaining(url: string): boolean {
  return /supabase\.co\/rest\/v1\/(approvals|case_task_requests|activity_log|cases)/i.test(url);
}

function workerRemaining(url: string): boolean {
  return (
    /\/api\/(approvals|case-task-requests|activity-log|cases\/for-employee|cases\/fcfs-pool|cases\/)/i.test(url) &&
    /localhost|127\.0\.0\.1/.test(url)
  );
}

export interface RemainingHarnessResult {
  ok: boolean;
  useWorkerRemainingReads: boolean;
  useWorkerReads: boolean;
  approvals: number;
  activity: number;
  taskRequests: number;
  employeeCases: number;
  supabaseReads: number;
  workerReads: number;
  duplicateRead: boolean;
  error?: string;
}

async function run(): Promise<RemainingHarnessResult> {
  netLog.length = 0;
  const result: RemainingHarnessResult = {
    ok: false,
    useWorkerRemainingReads: USE_WORKER_REMAINING_READS,
    useWorkerReads: USE_WORKER_READS,
    approvals: 0,
    activity: 0,
    taskRequests: 0,
    employeeCases: 0,
    supabaseReads: 0,
    workerReads: 0,
    duplicateRead: false,
  };

  try {
    const employee = {
      id: DEV_EMPLOYEE,
      department: 'Stores' as const,
      departments: ['Stores' as const],
    };
    const [approvals, activity, tasks, cases] = await Promise.all([
      sbApprovalRepo.getAll(),
      sbActivityRepo.getAll(),
      sbCaseTaskRequestRepo.getAll(),
      sbCaseRepo.getCasesForEmployeeIncludingPool(DEV_EMPLOYEE, employee),
    ]);
    result.approvals = approvals.length;
    result.activity = activity.length;
    result.taskRequests = tasks.length;
    result.employeeCases = cases.length;

    result.supabaseReads = netLog.filter((n) => supabaseRemaining(n.url)).length;
    result.workerReads = netLog.filter((n) => workerRemaining(n.url)).length;
    result.duplicateRead = result.supabaseReads > 0 && result.workerReads > 0;

    const hasData = result.approvals > 0 && result.activity > 0 && result.taskRequests > 0;

    const workerMode = USE_WORKER_REMAINING_READS && USE_WORKER_READS;
    if (workerMode) {
      result.ok =
        hasData &&
        result.workerReads > 0 &&
        result.supabaseReads === 0 &&
        !result.duplicateRead &&
        !netLog.some((n) => /\/api\/cases\?page=/.test(n.url) && n.url.includes('page=2'));
    } else if (USE_WORKER_REMAINING_READS && !USE_WORKER_READS) {
      result.ok = hasData && result.workerReads > 0 && result.supabaseReads === 0;
    } else {
      result.ok = hasData && result.workerReads === 0 && result.supabaseReads > 0;
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }

  return result;
}

async function main() {
  log(`VITE_USE_WORKER_REMAINING_READS=${USE_WORKER_REMAINING_READS}`);
  log(`VITE_USE_WORKER_READS=${USE_WORKER_READS}`);
  log(`WORKER_API_URL=${WORKER_API_URL}`);
  const result = await run();
  log(JSON.stringify(result, null, 2));
  (window as unknown as { __PHASE94_REMAINING_HARNESS__: RemainingHarnessResult }).__PHASE94_REMAINING_HARNESS__ =
    result;
}

main().catch((e) => log(String(e)));
