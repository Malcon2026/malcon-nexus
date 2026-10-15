import { eq } from 'drizzle-orm';
import type { AppRole } from '../middleware/auth';
import { employees } from '../db/schema';
import { createDb, type Db } from '../db/client';
import type { Env } from '../env';
import { withD1Retry } from './d1Retry';

export type MappedEmployee = {
  id: string;
  role: AppRole;
  name: string;
  email: string | null;
  authUserId: string | null;
};

const APP_ROLES: AppRole[] = ['admin', 'employee', 'petrol', 'store_manager'];

export function normalizeAppRole(raw: string | null | undefined): AppRole | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === 'store_manager' || lower === 'store manager') return 'store_manager';
  if (APP_ROLES.includes(lower as AppRole)) return lower as AppRole;
  return null;
}

export async function findEmployeeByAuthUserId(db: Db, authUserId: string): Promise<MappedEmployee | null> {
  const rows = await db
    .select({
      id: employees.id,
      role: employees.role,
      name: employees.name,
      email: employees.email,
      authUserId: employees.authUserId,
    })
    .from(employees)
    .where(eq(employees.authUserId, authUserId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const role = normalizeAppRole(row.role);
  if (!role) return null;
  return {
    id: row.id,
    role,
    name: row.name,
    email: row.email,
    authUserId: row.authUserId,
  };
}

export async function findEmployeeById(db: Db, employeeId: string): Promise<MappedEmployee | null> {
  const rows = await db
    .select({
      id: employees.id,
      role: employees.role,
      name: employees.name,
      email: employees.email,
      authUserId: employees.authUserId,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const role = normalizeAppRole(row.role);
  if (!role) return null;
  return {
    id: row.id,
    role,
    name: row.name,
    email: row.email,
    authUserId: row.authUserId,
  };
}

type EmployeeAuthRow = {
  id: string;
  role: string;
  name: string;
  email: string | null;
  auth_user_id: string | null;
};

function mapAuthRow(row: EmployeeAuthRow): MappedEmployee | null {
  const role = normalizeAppRole(row.role);
  if (!role) return null;
  return {
    id: row.id,
    role,
    name: row.name,
    email: row.email,
    authUserId: row.auth_user_id,
  };
}

/** Direct D1 prepare — fallback when Drizzle adapter fails on hot auth path. */
async function findEmployeeByAuthUserIdRaw(env: Env, authUserId: string): Promise<MappedEmployee | null> {
  const row = await env.DB.prepare(
    `SELECT id, role, name, email, auth_user_id FROM employees WHERE auth_user_id = ? LIMIT 1`,
  )
    .bind(authUserId)
    .first<EmployeeAuthRow>();
  return row ? mapAuthRow(row) : null;
}

async function findEmployeeByIdRaw(env: Env, employeeId: string): Promise<MappedEmployee | null> {
  const row = await env.DB.prepare(
    `SELECT id, role, name, email, auth_user_id FROM employees WHERE id = ? LIMIT 1`,
  )
    .bind(employeeId)
    .first<EmployeeAuthRow>();
  return row ? mapAuthRow(row) : null;
}

async function lookupEmployeeForAuthDrizzle(env: Env, subject: string): Promise<MappedEmployee | null> {
  const db = createDb(env);
  const byAuth = await findEmployeeByAuthUserId(db, subject);
  if (byAuth) return byAuth;
  return findEmployeeById(db, subject);
}

/** Resolve JWT `sub` → employee (auth_user_id first, then primary key). */
export async function lookupEmployeeForAuth(env: Env, subject: string): Promise<MappedEmployee | null> {
  try {
    return await withD1Retry(() => lookupEmployeeForAuthDrizzle(env, subject));
  } catch {
    if (!env.DB) throw new Error('Employee auth lookup failed');
    const byAuth = await findEmployeeByAuthUserIdRaw(env, subject);
    if (byAuth) return byAuth;
    return findEmployeeByIdRaw(env, subject);
  }
}
