import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { appSettings, doctors, employees, hospitals } from '../../db/schema';
import { mergeDoctorMasterList } from '../../lib/doctorMaster';
import { nowIso } from '../../lib/writeContext';
import type { RequestContext } from '../../middleware/auth';
import { AuthError } from '../../middleware/authorization';
import { assertAdminWrite } from '../../middleware/writeAuth';

export async function createEmployee(
  db: Db,
  ctx: RequestContext,
  body: {
    id: string;
    name: string;
    email: string;
    department: string;
    departments: string[];
    role: string;
    status: string;
    avatar?: string;
    phone?: string;
    employeeCode?: string | null;
    casesCompleted?: number;
    casesActive?: number;
    joinDate: string;
  },
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  const ts = nowIso();
  await db.insert(employees).values({
    id: body.id,
    name: body.name,
    email: body.email,
    department: body.department,
    departments: JSON.stringify(body.departments ?? []),
    role: body.role,
    status: body.status,
    avatar: body.avatar ?? '',
    phone: body.phone ?? '',
    employeeCode: body.employeeCode?.trim() || null,
    casesCompleted: body.casesCompleted ?? 0,
    casesActive: body.casesActive ?? 0,
    joinDate: body.joinDate,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateEmployee(
  db: Db,
  ctx: RequestContext,
  id: string,
  updates: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  const existingRows = await db
    .select({ id: employees.id, department: employees.department, departments: employees.departments })
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1);
  if (!existingRows.length) throw new AuthError('Not found', 404);
  const set: Record<string, unknown> = { updatedAt: nowIso() };
  if (updates.name) set.name = updates.name;
  if (updates.email) set.email = updates.email;
  if (updates.department) set.department = updates.department;
  if (updates.departments !== undefined) {
    set.departments = JSON.stringify(updates.departments);
  } else if (updates.department) {
    try {
      const prev = JSON.parse(existingRows[0].departments) as string[];
      const dept = updates.department as string;
      set.departments = JSON.stringify(prev.includes(dept) ? prev : [...prev, dept]);
    } catch {
      set.departments = JSON.stringify([updates.department]);
    }
  }
  if (updates.role) set.role = updates.role;
  if (updates.status) set.status = updates.status;
  if (updates.avatar) set.avatar = updates.avatar;
  if (updates.phone) set.phone = updates.phone;
  if (updates.employeeCode !== undefined) {
    const code = String(updates.employeeCode ?? '').trim();
    set.employeeCode = code || null;
  }
  if (updates.casesCompleted !== undefined) set.casesCompleted = updates.casesCompleted;
  if (updates.casesActive !== undefined) set.casesActive = updates.casesActive;
  if (updates.joinDate) set.joinDate = updates.joinDate;
  await db.update(employees).set(set).where(eq(employees.id, id));
}

export async function deleteEmployee(
  db: Db,
  ctx: RequestContext,
  id: string,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  await db.delete(employees).where(eq(employees.id, id));
}

/**
 * Self-heal auth_user_id on login (Supabase linkAuthUser equivalent).
 * Only when JWT email matches employee row and row is unlinked or already linked to this auth user.
 */
export async function linkAuthUserForSession(
  db: Db,
  ctx: RequestContext,
  employeeId: string,
  relaxed: boolean,
): Promise<void> {
  if (relaxed && !ctx.identity) return;
  if (!ctx.identity) throw new AuthError('Unauthorized', 401);

  const rows = await db
    .select({
      id: employees.id,
      email: employees.email,
      authUserId: employees.authUserId,
    })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new AuthError('Not found', 404);

  if (row.authUserId && row.authUserId !== ctx.identity.authUserId) {
    throw new AuthError('Forbidden', 403);
  }

  const jwtEmail = ctx.identity.email?.trim().toLowerCase();
  const rowEmail = row.email?.trim().toLowerCase();
  if (!jwtEmail || !rowEmail || jwtEmail !== rowEmail) {
    throw new AuthError('Forbidden', 403);
  }

  if (row.authUserId === ctx.identity.authUserId) return;

  await db
    .update(employees)
    .set({ authUserId: ctx.identity.authUserId, updatedAt: nowIso() })
    .where(eq(employees.id, employeeId));
}

export async function createHospital(
  db: Db,
  ctx: RequestContext,
  body: {
    id: string;
    name: string;
    branch?: string;
    address?: string;
    city?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    status: string;
  },
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  const ts = nowIso();
  await db.insert(hospitals).values({
    id: body.id,
    name: body.name,
    branch: body.branch ?? '',
    address: body.address ?? '',
    city: body.city ?? '',
    contactPerson: body.contactPerson ?? '',
    phone: body.phone ?? '',
    email: body.email ?? '',
    status: body.status,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function updateHospital(
  db: Db,
  ctx: RequestContext,
  id: string,
  patch: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  const exists = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.id, id)).limit(1);
  if (!exists.length) throw new AuthError('Not found', 404);
  const set: Record<string, unknown> = { updatedAt: nowIso() };
  if (patch.name) set.name = patch.name;
  if (patch.branch !== undefined) set.branch = patch.branch;
  if (patch.address !== undefined) set.address = patch.address;
  if (patch.city) set.city = patch.city;
  if (patch.contactPerson !== undefined) set.contactPerson = patch.contactPerson;
  if (patch.phone !== undefined) set.phone = patch.phone;
  if (patch.email !== undefined) set.email = patch.email;
  if (patch.status) set.status = patch.status;
  await db.update(hospitals).set(set).where(eq(hospitals.id, id));
}

export async function deleteHospital(
  db: Db,
  ctx: RequestContext,
  id: string,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  await db.delete(hospitals).where(eq(hospitals.id, id));
}

export async function createDoctor(
  db: Db,
  ctx: RequestContext,
  body: {
    id: string;
    name: string;
    specialization?: string;
    hospitalId?: string | null;
    phone?: string;
    doctorCode?: string;
  },
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  const ts = nowIso();
  if (body.hospitalId) {
    const h = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.id, body.hospitalId)).limit(1);
    if (!h.length) throw new Error('Invalid hospital_id');
  }
  await db.insert(doctors).values({
    id: body.id,
    name: body.name,
    specialization: body.specialization ?? '',
    hospitalId: body.hospitalId || null,
    phone: body.phone ?? '',
    doctorCode: body.doctorCode ?? null,
    createdAt: ts,
  });
  if (body.doctorCode) {
    const setting = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'doctor_master_list'))
      .limit(1);
    const value = mergeDoctorMasterList(setting[0]?.value, {
      code: body.doctorCode,
      name: body.name,
      id: body.id,
    });
    await db
      .insert(appSettings)
      .values({ key: 'doctor_master_list', value, updatedBy: '', updatedAt: ts })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: ts },
      });
  }
}

export async function updateDoctor(
  db: Db,
  ctx: RequestContext,
  id: string,
  patch: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  const exists = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, id)).limit(1);
  if (!exists.length) throw new AuthError('Not found', 404);
  const set: Record<string, unknown> = {};
  if (patch.name) set.name = patch.name;
  if (patch.specialization) set.specialization = patch.specialization;
  if (patch.hospitalId) set.hospitalId = patch.hospitalId;
  if (patch.phone) set.phone = patch.phone;
  if (patch.doctorCode !== undefined) set.doctorCode = patch.doctorCode;
  await db.update(doctors).set(set).where(eq(doctors.id, id));
}

export async function deleteDoctor(db: Db, ctx: RequestContext, id: string, relaxed: boolean): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  await db.delete(doctors).where(eq(doctors.id, id));
}
