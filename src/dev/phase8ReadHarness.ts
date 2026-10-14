/**
 * Local-only Phase 8 browser validation (not linked from production SPA).
 * Invoked via phase8-harness.html during automated tests.
 */
import { sbEmployeeRepo, sbCaseRepo } from '../lib/database/repositories/supabaseRepositories';
import { USE_WORKER_READS, WORKER_API_URL } from '../lib/workerReadConfig';

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

function isSupabaseEmployees(url: string): boolean {
  return /supabase\.co\/rest\/v1\/employees/i.test(url);
}

function isSupabaseCases(url: string): boolean {
  return /supabase\.co\/rest\/v1\/cases/i.test(url);
}

function isWorkerEmployees(url: string): boolean {
  return /\/api\/employees/i.test(url) && url.includes('127.0.0.1');
}

function isWorkerCases(url: string): boolean {
  return /\/api\/cases/i.test(url) && url.includes('127.0.0.1');
}

export interface HarnessResult {
  ok: boolean;
  useWorkerReads: boolean;
  workerApiUrl: string;
  employeesCount: number;
  casesCount: number;
  employeeDetailOk: boolean;
  caseDetailOk: boolean;
  supabaseEmployeeReads: number;
  supabaseCaseReads: number;
  workerEmployeeReads: number;
  workerCaseReads: number;
  duplicateEmployeeRead: boolean;
  duplicateCaseRead: boolean;
  error?: string;
}

async function runHarness(): Promise<HarnessResult> {
  netLog.length = 0;
  const result: HarnessResult = {
    ok: false,
    useWorkerReads: USE_WORKER_READS,
    workerApiUrl: WORKER_API_URL,
    employeesCount: 0,
    casesCount: 0,
    employeeDetailOk: false,
    caseDetailOk: false,
    supabaseEmployeeReads: 0,
    supabaseCaseReads: 0,
    workerEmployeeReads: 0,
    workerCaseReads: 0,
    duplicateEmployeeRead: false,
    duplicateCaseRead: false,
  };

  try {
    const employees = await sbEmployeeRepo.getAll();
    result.employeesCount = employees.length;
    if (employees[0]) {
      const one = await sbEmployeeRepo.getById(employees[0].id);
      result.employeeDetailOk = one?.id === employees[0].id;
    }

    const cases = await sbCaseRepo.getAll();
    result.casesCount = cases.length;
    if (cases[0]) {
      const oneCase = await sbCaseRepo.getById(cases[0].id);
      result.caseDetailOk = oneCase?.id === cases[0].id;
    }

    result.supabaseEmployeeReads = netLog.filter((n) => isSupabaseEmployees(n.url)).length;
    result.supabaseCaseReads = netLog.filter((n) => isSupabaseCases(n.url)).length;
    result.workerEmployeeReads = netLog.filter((n) => isWorkerEmployees(n.url)).length;
    result.workerCaseReads = netLog.filter((n) => isWorkerCases(n.url)).length;
    result.duplicateEmployeeRead =
      result.supabaseEmployeeReads > 0 && result.workerEmployeeReads > 0;
    result.duplicateCaseRead = result.supabaseCaseReads > 0 && result.workerCaseReads > 0;

    if (USE_WORKER_READS) {
      result.ok =
        result.employeesCount > 0 &&
        result.casesCount > 0 &&
        result.employeeDetailOk &&
        result.caseDetailOk &&
        result.workerEmployeeReads > 0 &&
        result.workerCaseReads > 0 &&
        !result.duplicateEmployeeRead &&
        !result.duplicateCaseRead;
    } else {
      result.ok =
        result.employeesCount > 0 &&
        result.casesCount > 0 &&
        result.employeeDetailOk &&
        result.caseDetailOk &&
        result.workerEmployeeReads === 0 &&
        result.workerCaseReads === 0 &&
        result.supabaseEmployeeReads > 0 &&
        result.supabaseCaseReads > 0;
    }
  } catch (e) {
    result.error =
      e instanceof Error
        ? e.message
        : typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message: unknown }).message)
          : String(e);
    result.ok = false;
  }

  return result;
}

async function main() {
  const status = document.getElementById('status');
  log(`USE_WORKER_READS=${USE_WORKER_READS}`);
  log(`WORKER_API_URL=${WORKER_API_URL}`);
  const result = await runHarness();
  log(JSON.stringify(result, null, 2));
  (window as unknown as { __PHASE8_HARNESS_RESULT__?: HarnessResult }).__PHASE8_HARNESS_RESULT__ =
    result;
  if (status) {
    status.textContent = result.ok ? 'PASS' : 'FAIL';
    status.className = result.ok ? 'pass' : 'fail';
  }
}

void main();
