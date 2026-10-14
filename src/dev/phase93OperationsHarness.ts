import {
  sbAttendanceApprovalRepo,
  sbAttendanceRepo,
  sbExpenseRepo,
  sbFieldTeamAttendanceRepo,
  sbFoodRepo,
  sbLeaveRepo,
  sbLocationTripRepo,
  sbPetrolRepo,
} from '../lib/database/repositories/supabaseRepositories';
import { USE_WORKER_OPERATIONS_READS, WORKER_API_URL } from '../lib/workerReadConfig';

const DEV_EMPLOYEE = 'a1000001-0001-4001-8001-000000000001';
const SINCE = '2020-01-01T00:00:00.000Z';

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

function supabaseOps(url: string): boolean {
  return /supabase\.co\/rest\/v1\/(attendance_records|attendance_approval_requests|field_team_attendance_approvals|leave_requests|petrol_requests|location_trips|employee_food_selections|employee_daily_expenses)/i.test(
    url,
  );
}

function workerOps(url: string): boolean {
  return (
    /\/api\/(attendance-records|attendance-approval-requests|field-team-attendance|leave-requests|petrol-requests|location-trips|food-selections|daily-expenses|employees\/[^/]+\/attendance)/i.test(
      url,
    ) && /localhost|127\.0\.0\.1/.test(url)
  );
}

export interface OperationsHarnessResult {
  ok: boolean;
  useWorkerOperationsReads: boolean;
  attendance: number;
  attendanceApprovals: number;
  fieldTeam: number;
  leave: number;
  petrol: number;
  trips: number;
  food: number;
  expenses: number;
  supabaseReads: number;
  workerReads: number;
  duplicateRead: boolean;
  error?: string;
}

async function run(): Promise<OperationsHarnessResult> {
  netLog.length = 0;
  const result: OperationsHarnessResult = {
    ok: false,
    useWorkerOperationsReads: USE_WORKER_OPERATIONS_READS,
    attendance: 0,
    attendanceApprovals: 0,
    fieldTeam: 0,
    leave: 0,
    petrol: 0,
    trips: 0,
    food: 0,
    expenses: 0,
    supabaseReads: 0,
    workerReads: 0,
    duplicateRead: false,
  };

  try {
    const [
      attendance,
      attendanceApprovals,
      fieldTeam,
      leave,
      petrol,
      trips,
      food,
      expenses,
    ] = await Promise.all([
      sbAttendanceRepo.getRecentForEmployee(DEV_EMPLOYEE, SINCE),
      sbAttendanceApprovalRepo.getForEmployee(DEV_EMPLOYEE),
      sbFieldTeamAttendanceRepo.getForDate('2026-04-15'),
      sbLeaveRepo.getForEmployee(DEV_EMPLOYEE),
      sbPetrolRepo.getAll(),
      sbLocationTripRepo.getForEmployee(DEV_EMPLOYEE),
      sbFoodRepo.getForDateRange('2026-04-01', '2026-04-30'),
      sbExpenseRepo.getAll(),
    ]);

    result.attendance = attendance.length;
    result.attendanceApprovals = attendanceApprovals.length;
    result.fieldTeam = fieldTeam.length;
    result.leave = leave.length;
    result.petrol = petrol.length;
    result.trips = trips.length;
    result.food = food.length;
    result.expenses = expenses.length;

    result.supabaseReads = netLog.filter((n) => supabaseOps(n.url)).length;
    result.workerReads = netLog.filter((n) => workerOps(n.url)).length;
    result.duplicateRead = result.supabaseReads > 0 && result.workerReads > 0;

    const hasData =
      result.attendance > 0 &&
      result.petrol > 0 &&
      result.expenses > 0 &&
      result.food > 0;

    if (USE_WORKER_OPERATIONS_READS) {
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
  log(`VITE_USE_WORKER_OPERATIONS_READS=${USE_WORKER_OPERATIONS_READS}`);
  log(`WORKER_API_URL=${WORKER_API_URL}`);
  const result = await run();
  log(JSON.stringify(result, null, 2));
  (window as unknown as { __PHASE93_OPERATIONS_HARNESS__: OperationsHarnessResult }).__PHASE93_OPERATIONS_HARNESS__ =
    result;
}

main().catch((e) => {
  log(String(e));
});
