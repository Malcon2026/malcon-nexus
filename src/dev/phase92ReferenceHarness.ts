import {
  sbDepartmentRepo,
  sbDoctorRepo,
  sbHospitalRepo,
  sbKitRepo,
  sbSettingsRepo,
} from '../lib/database/repositories/supabaseRepositories';
import { USE_WORKER_REFERENCE_READS, WORKER_API_URL } from '../lib/workerReadConfig';

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

function supabaseRef(url: string): boolean {
  return /supabase\.co\/rest\/v1\/(hospitals|doctors|departments|surgical_kits|app_settings)/i.test(url);
}

function workerRef(url: string): boolean {
  return /\/api\/(hospitals|doctors|departments|surgical-kits|settings)/i.test(url) && /localhost|127\.0\.0\.1/.test(url);
}

export interface ReferenceHarnessResult {
  ok: boolean;
  useWorkerReferenceReads: boolean;
  hospitals: number;
  doctors: number;
  departments: number;
  kits: number;
  settingsKeys: number;
  supabaseReads: number;
  workerReads: number;
  duplicateRead: boolean;
  error?: string;
}

async function run(): Promise<ReferenceHarnessResult> {
  netLog.length = 0;
  const result: ReferenceHarnessResult = {
    ok: false,
    useWorkerReferenceReads: USE_WORKER_REFERENCE_READS,
    hospitals: 0,
    doctors: 0,
    departments: 0,
    kits: 0,
    settingsKeys: 0,
    supabaseReads: 0,
    workerReads: 0,
    duplicateRead: false,
  };

  try {
    const [hospitals, doctors, departments, kits, settings] = await Promise.all([
      sbHospitalRepo.getAll(),
      sbDoctorRepo.getAll(),
      sbDepartmentRepo.getAll(),
      sbKitRepo.getAll(),
      sbSettingsRepo.getAll(),
    ]);
    result.hospitals = hospitals.length;
    result.doctors = doctors.length;
    result.departments = departments.length;
    result.kits = kits.length;
    result.settingsKeys = Object.keys(settings).length;

    result.supabaseReads = netLog.filter((n) => supabaseRef(n.url)).length;
    result.workerReads = netLog.filter((n) => workerRef(n.url)).length;
    result.duplicateRead = result.supabaseReads > 0 && result.workerReads > 0;

    const hasData =
      result.hospitals > 0 &&
      result.doctors > 0 &&
      result.departments > 0 &&
      result.kits > 0;

    if (USE_WORKER_REFERENCE_READS) {
      result.ok = hasData && result.workerReads > 0 && result.supabaseReads === 0 && !result.duplicateRead;
    } else {
      result.ok = hasData && result.workerReads === 0 && result.supabaseReads > 0;
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }

  return result;
}

async function main() {
  log(`VITE_USE_WORKER_REFERENCE_READS=${USE_WORKER_REFERENCE_READS}`);
  log(`WORKER_API_URL=${WORKER_API_URL}`);
  const result = await run();
  log(JSON.stringify(result, null, 2));
  (window as unknown as { __PHASE92_REFERENCE_HARNESS__?: ReferenceHarnessResult }).__PHASE92_REFERENCE_HARNESS__ =
    result;
  const status = document.getElementById('status');
  if (status) {
    status.textContent = result.ok ? 'PASS' : 'FAIL';
    status.className = result.ok ? 'pass' : 'fail';
  }
}

void main();
