import type { Employee, ImplantCase, StageRecord } from '../types';

export const CHANDRA_GAJELLI_EMAIL = 'chandra.gajelli@malconnexus.com';
export const CHANDRA_GAJELLI_ID = '6589771b-07a6-4d20-b674-8e075f79dce3';

export const SRIVANI_EMAIL = 'srivani.adire@malconnexus.com';
export const SRIVANI_ID = 'a2e860c9-c136-4c51-a826-7fde024bb1f3';

export const RAMAKANTH_EMAIL = 'ramakanth.perumandla@malconnexus.com';
export const RAMAKANTH_ID = '81f59008-ee3c-44aa-a6eb-702ca7de9db6';

export const CHECKING_POOL_LABEL = 'FCFS Pool (Srivani & Ramakanth)';

/** Check if an employee is Chandra Gajelli (assigned to Restock). */
export function isChandraGajelli(
  emp: Pick<Employee, 'id' | 'name' | 'email'> | null | undefined,
): boolean {
  if (!emp) return false;
  if (emp.id === CHANDRA_GAJELLI_ID) return true;
  const email = (emp.email ?? '').toLowerCase().trim();
  if (email === CHANDRA_GAJELLI_EMAIL) return true;
  const name = (emp.name ?? '').toLowerCase().trim();
  return name.includes('chandra') && name.includes('gajel');
}

/** Find Chandra Gajelli in the employees collection. */
export function findChandraGajelli(employees: Employee[]): Employee | undefined {
  return employees.find(isChandraGajelli);
}

/** Check if an employee is eligible for the Checking & Audit FCFS pool (Srivani & Ramakanth). */
export function isCheckingPoolEmployee(
  emp: Pick<Employee, 'id' | 'name' | 'email'> | null | undefined,
): boolean {
  if (!emp) return false;
  if (emp.id === SRIVANI_ID || emp.id === RAMAKANTH_ID) return true;
  const email = (emp.email ?? '').toLowerCase().trim();
  if (
    email === SRIVANI_EMAIL ||
    email === RAMAKANTH_EMAIL ||
    email.includes('srivani') ||
    email.includes('ramakanth')
  ) {
    return true;
  }
  const name = (emp.name ?? '').toLowerCase().trim();
  return name.includes('srivani') || name.includes('ramakanth');
}

function findCheckingStageRecord(stages: StageRecord[] | null | undefined): StageRecord | undefined {
  if (!stages) return undefined;
  return stages.find((s) => {
    const st = (s.stage ?? '').trim();
    return (
      st === 'Checking & Audit' ||
      st === 'Checking and Audit' ||
      st === 'Cleaning' ||
      st === 'Audit' ||
      st === 'Cleaning & Audit'
    );
  });
}

function isCheckingStageName(stage: string | null | undefined): boolean {
  const st = (stage ?? '').trim();
  return (
    st === 'Checking & Audit' ||
    st === 'Checking and Audit' ||
    st === 'Cleaning' ||
    st === 'Audit' ||
    st === 'Cleaning & Audit'
  );
}

/** Check if a case is currently waiting in the Checking & Audit FCFS pool (unassigned). */
export function isCheckingPoolCase(c: ImplantCase): boolean {
  if (c.status === 'Completed' || c.status === 'Cancelled') return false;
  if (!isCheckingStageName(c.currentStage)) return false;
  const stageRec = findCheckingStageRecord(c.stages);
  if (!stageRec) return false;
  if (stageRec.status === 'Submitted' || stageRec.status === 'Approved') return false;
  // If no employee is assigned yet, it is available in the pool
  return !stageRec.assignedEmployee;
}

/** Check if the current user can claim an unassigned Checking & Audit case. */
export function canEmployeeClaimCheckingCase(
  c: ImplantCase,
  emp: Pick<Employee, 'id' | 'name' | 'email' | 'role'> | null | undefined,
): boolean {
  if (!emp || !isCheckingPoolCase(c)) return false;
  return isCheckingPoolEmployee(emp) || emp.role === 'admin' || emp.role === 'store_manager';
}

