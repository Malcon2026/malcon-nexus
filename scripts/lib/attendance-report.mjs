/**
 * Attendance report helpers for office-server scripts (mirrors src/lib/attendance.ts).
 */

const IST = 'Asia/Kolkata';

export function getISTDateKey(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-CA', { timeZone: IST });
}

export function formatTimeIST(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-IN', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatShareDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: IST,
  });
}

export function formatShortShiftDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: IST,
  });
}

function groupByEmployee(records) {
  const byEmployee = new Map();
  for (const record of records) {
    const list = byEmployee.get(record.employeeId);
    if (list) list.push(record);
    else byEmployee.set(record.employeeId, [record]);
  }
  for (const list of byEmployee.values()) {
    list.sort((a, b) => new Date(a.punchedAt).getTime() - new Date(b.punchedAt).getTime());
  }
  return byEmployee;
}

function pairSortedShifts(sorted) {
  const pairs = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].punchType !== 'in') continue;
    const punchOut = sorted.slice(i + 1).find((r) => r.punchType === 'out') ?? null;
    pairs.push({ punchIn: sorted[i], punchOut });
  }
  return pairs;
}

function openShiftFromSorted(sorted) {
  const last = sorted[sorted.length - 1];
  if (!last || last.punchType !== 'in') return null;
  return { punchIn: last };
}

function summaryFromPair(match, open, nowMs) {
  if (!match) {
    return { punchIn: null, punchOut: null, isPunchedIn: false, workedMs: 0 };
  }
  const { punchIn, punchOut } = match;
  const isPunchedIn = !punchOut && open?.punchIn.id === punchIn.id;
  let workedMs = 0;
  if (punchOut) {
    workedMs = new Date(punchOut.punchedAt).getTime() - new Date(punchIn.punchedAt).getTime();
  } else if (isPunchedIn) {
    workedMs = nowMs - new Date(punchIn.punchedAt).getTime();
  }
  return { punchIn, punchOut, isPunchedIn, workedMs };
}

function buildDayIndex(records) {
  const byEmployee = groupByEmployee(records);
  const index = new Map();
  const nowMs = Date.now();

  for (const [employeeId, sorted] of byEmployee) {
    const pairs = pairSortedShifts(sorted);
    const open = openShiftFromSorted(sorted);
    const byDate = new Map();
    for (const pair of pairs) {
      const dateKey = getISTDateKey(pair.punchIn.punchedAt);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, summaryFromPair(pair, open, nowMs));
      }
    }
    index.set(employeeId, byDate);
  }
  return index;
}

function getOpenShift(records, employeeId) {
  const sorted = records
    .filter((r) => r.employeeId === employeeId)
    .sort((a, b) => new Date(a.punchedAt).getTime() - new Date(b.punchedAt).getTime());
  return openShiftFromSorted(sorted);
}

function getUnclosedShiftFromDateKey(records, employeeId, dateKey) {
  const open = getOpenShift(records, employeeId);
  if (!open) return null;
  const shiftDateKey = getISTDateKey(open.punchIn.punchedAt);
  return shiftDateKey < dateKey ? shiftDateKey : null;
}

function getAttendanceDayStatus(summary) {
  if (!summary.punchIn) return 'absent';
  if (summary.isPunchedIn) return 'in';
  return 'out';
}

function isAttendanceStaff(person) {
  return (person.role === 'employee' || person.role === 'admin') && person.status === 'Active';
}

const EMPTY_SUMMARY = { punchIn: null, punchOut: null, isPunchedIn: false, workedMs: 0 };

export function buildEmployeeAttendanceReport(employees, records, dateKey = getISTDateKey()) {
  const dayIndex = buildDayIndex(records);
  return employees
    .filter(isAttendanceStaff)
    .map((employee) => {
      const summary = dayIndex.get(employee.id)?.get(dateKey) ?? EMPTY_SUMMARY;
      const unclosedFrom = getUnclosedShiftFromDateKey(records, employee.id, dateKey);
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.department,
        status: getAttendanceDayStatus(summary),
        unclosedPriorShift: unclosedFrom !== null,
        unclosedShiftFromDateKey: unclosedFrom,
        ...summary,
      };
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

const FILTER_TITLES = {
  in: 'Punched In Today',
  out: 'Punched Out Today',
  absent: 'Absent Today',
  unclosed: 'Unclosed Shift (forgot Punch Out)',
};

export function shareDetailLines(row, filterStatus) {
  const lines = [];
  if (filterStatus === 'in' || (filterStatus === 'unclosed' && row.status === 'in')) {
    if (row.punchIn) lines.push(`In ${formatTimeIST(row.punchIn.punchedAt)}`);
  } else if (filterStatus === 'out') {
    const inT = row.punchIn ? formatTimeIST(row.punchIn.punchedAt) : '—';
    const outT = row.punchOut ? formatTimeIST(row.punchOut.punchedAt) : '—';
    lines.push(`In ${inT} · Out ${outT}`);
  } else if (filterStatus === 'absent' && row.status === 'absent') {
    lines.push('Absent');
  }
  if (row.unclosedPriorShift && row.unclosedShiftFromDateKey) {
    lines.push(`Unclosed shift from ${formatShortShiftDate(row.unclosedShiftFromDateKey)}`);
    if (filterStatus === 'unclosed' && row.punchIn) {
      lines.push(`Still IN since ${formatTimeIST(row.punchIn.punchedAt)}`);
    }
  }
  return lines;
}

export function buildShareListRows(employees, records, dateKey, filterStatus) {
  const report = buildEmployeeAttendanceReport(employees, records, dateKey);
  return report
    .filter((row) => {
      if (row.department === 'Admin') return false;
      if (filterStatus === 'unclosed') return row.unclosedPriorShift;
      if (filterStatus === 'all') return true;
      return row.status === filterStatus;
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export function shareTitleForFilter(filterStatus) {
  return FILTER_TITLES[filterStatus] ?? 'All Staff';
}

export function mapAttendanceRow(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    punchType: row.punch_type,
    punchedAt: row.punched_at,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyM: row.accuracy_m,
    distanceM: row.distance_m,
    withinOffice: row.within_office,
    officeAddress: row.office_address,
  };
}

export function mapEmployeeRow(row) {
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    role: row.role,
    status: row.status,
  };
}
