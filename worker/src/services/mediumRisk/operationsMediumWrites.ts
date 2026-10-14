import { and, eq, inArray, ne, or } from 'drizzle-orm';
import type { Db } from '../../db/client';
import {
  attendanceApprovalRequests,
  attendanceRecords,
  caseTaskRequests,
  employeeFoodSelections,
  employees,
  fieldTeamAttendanceApprovals,
  leaveRequests,
  locationTrips,
  petrolRequests,
} from '../../db/schema';
import { nowIso } from '../../lib/writeContext';
import type { RequestContext } from '../../middleware/auth';
import { AuthError } from '../../middleware/authorization';
import {
  assertAdminOrStoreManager,
  assertAdminWrite,
  assertCaseTaskAdmin,
  assertEmployeeSelfOrAdmin,
  assertPetrolWrite,
  requireMappedEmployeeId,
} from '../../middleware/writeAuth';

// ─── Attendance records ───────────────────────────────────────

export async function insertAttendanceRecord(
  db: Db,
  ctx: RequestContext,
  record: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  const employeeId = record.employeeId as string;
  assertEmployeeSelfOrAdmin(ctx, employeeId, relaxed);
  const ts = nowIso();
  await db.insert(attendanceRecords).values({
    id: record.id as string,
    employeeId,
    employeeName: (record.employeeName as string) ?? '',
    punchType: record.punchType as string,
    punchedAt: record.punchedAt as string,
    latitude: Number(record.latitude ?? 0),
    longitude: Number(record.longitude ?? 0),
    accuracyM: Number(record.accuracyM ?? 0),
    distanceM: Number(record.distanceM ?? 0),
    withinOffice: Boolean(record.withinOffice),
    officeAddress: (record.officeAddress as string) ?? '',
    selfieUrl: (record.selfieUrl as string | null) ?? null,
    createdAt: ts,
  });
}

export async function patchAttendanceRecord(
  db: Db,
  ctx: RequestContext,
  id: string,
  updates: { selfieUrl?: string },
  relaxed: boolean,
): Promise<void> {
  const rows = await db
    .select({ employeeId: attendanceRecords.employeeId })
    .from(attendanceRecords)
    .where(eq(attendanceRecords.id, id))
    .limit(1);
  if (!rows.length) throw new AuthError('Not found', 404);
  assertEmployeeSelfOrAdmin(ctx, rows[0].employeeId, relaxed);
  if (updates.selfieUrl === undefined) return;
  await db.update(attendanceRecords).set({ selfieUrl: updates.selfieUrl }).where(eq(attendanceRecords.id, id));
}

export async function deleteAttendanceByIds(
  db: Db,
  ctx: RequestContext,
  ids: string[],
  relaxed: boolean,
): Promise<void> {
  assertAdminOrStoreManager(ctx, relaxed);
  if (!ids.length) return;
  await db.delete(attendanceRecords).where(inArray(attendanceRecords.id, ids));
}

// ─── Attendance approval requests ─────────────────────────────

export async function insertAttendanceApproval(
  db: Db,
  ctx: RequestContext,
  req: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  const employeeId = req.employeeId as string;
  assertEmployeeSelfOrAdmin(ctx, employeeId, relaxed);
  const ts = nowIso();
  await db.insert(attendanceApprovalRequests).values({
    id: req.id as string,
    employeeId,
    employeeName: (req.employeeName as string) ?? '',
    punchType: req.punchType as string,
    requestedAt: req.requestedAt as string,
    latitude: Number(req.latitude ?? 0),
    longitude: Number(req.longitude ?? 0),
    accuracyM: Number(req.accuracyM ?? 0),
    distanceM: Number(req.distanceM ?? 0),
    reason: (req.reason as string) ?? '',
    status: (req.status as string) ?? 'pending',
    reviewedBy: (req.reviewedBy as string | null) ?? null,
    reviewedById: (req.reviewedById as string | null) ?? null,
    reviewedAt: (req.reviewedAt as string | null) ?? null,
    adminNotes: (req.adminNotes as string | null) ?? null,
    attendanceRecordId: (req.attendanceRecordId as string | null) ?? null,
    selfieUrl: (req.selfieUrl as string | null) ?? null,
    createdAt: ts,
  });
}

export async function patchAttendanceApproval(
  db: Db,
  ctx: RequestContext,
  id: string,
  updates: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  assertAdminOrStoreManager(ctx, relaxed);
  const set: Record<string, unknown> = {};
  for (const key of [
    'status',
    'reviewedBy',
    'reviewedById',
    'reviewedAt',
    'adminNotes',
    'attendanceRecordId',
    'selfieUrl',
  ] as const) {
    if (updates[key] !== undefined) set[key] = updates[key];
  }
  if (!Object.keys(set).length) return;
  await db.update(attendanceApprovalRequests).set(set).where(eq(attendanceApprovalRequests.id, id));
}

export async function deleteAttendanceApprovalsByIds(
  db: Db,
  ctx: RequestContext,
  ids: string[],
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  if (!ids.length) return;
  await db.delete(attendanceApprovalRequests).where(inArray(attendanceApprovalRequests.id, ids));
}

// ─── Field team ───────────────────────────────────────────────

export async function upsertFieldTeamAttendance(
  db: Db,
  ctx: RequestContext,
  row: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  await db
    .insert(fieldTeamAttendanceApprovals)
    .values({
      id: row.id as string,
      employeeId: row.employeeId as string,
      employeeName: (row.employeeName as string) ?? '',
      department: (row.department as string) ?? '',
      dateKey: row.dateKey as string,
      status: (row.status as string) ?? 'pending',
      reviewedBy: (row.reviewedBy as string | null) ?? null,
      reviewedById: (row.reviewedById as string | null) ?? null,
      reviewedAt: (row.reviewedAt as string | null) ?? null,
      adminNotes: (row.adminNotes as string | null) ?? null,
      createdAt: (row.createdAt as string) ?? nowIso(),
      updatedAt: (row.updatedAt as string) ?? nowIso(),
    })
    .onConflictDoUpdate({
      target: [fieldTeamAttendanceApprovals.employeeId, fieldTeamAttendanceApprovals.dateKey],
      set: {
        employeeName: (row.employeeName as string) ?? '',
        department: (row.department as string) ?? '',
        status: (row.status as string) ?? 'pending',
        reviewedBy: (row.reviewedBy as string | null) ?? null,
        reviewedById: (row.reviewedById as string | null) ?? null,
        reviewedAt: (row.reviewedAt as string | null) ?? null,
        adminNotes: (row.adminNotes as string | null) ?? null,
        updatedAt: (row.updatedAt as string) ?? nowIso(),
      },
    });
}

export async function patchFieldTeamAttendance(
  db: Db,
  ctx: RequestContext,
  id: string,
  updates: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  const set: Record<string, unknown> = { updatedAt: nowIso() };
  for (const key of ['status', 'reviewedBy', 'reviewedById', 'reviewedAt', 'adminNotes', 'employeeName', 'department'] as const) {
    if (updates[key] !== undefined) set[key] = updates[key];
  }
  await db.update(fieldTeamAttendanceApprovals).set(set).where(eq(fieldTeamAttendanceApprovals.id, id));
}

// ─── Leave ────────────────────────────────────────────────────

const LEAVE_TYPES = new Set(['Casual', 'Sick', 'Unpaid', 'Comp Off']);

export async function submitOwnLeave(
  db: Db,
  ctx: RequestContext,
  body: {
    id?: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    reason: string;
    compOffWorkDate?: string | null;
  },
  relaxed: boolean,
): Promise<void> {
  const employeeId = requireMappedEmployeeId(ctx, relaxed);
  const empRows = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  const emp = empRows[0];
  if (!emp) throw new AuthError('Your login is not linked to an employee record. Log out and log in again.', 403);

  if (!LEAVE_TYPES.has(body.leaveType)) throw new AuthError('Invalid leave type.', 400);
  if (!body.fromDate || !body.toDate || body.fromDate > body.toDate) {
    throw new AuthError('Invalid leave dates.', 400);
  }
  const reason = (body.reason ?? '').trim();
  if (reason.length < 10) throw new AuthError('Please provide a reason (at least 10 characters).', 400);

  const ts = nowIso();
  const id = body.id?.trim() || crypto.randomUUID();
  await db.insert(leaveRequests).values({
    id,
    employeeId: emp.id,
    employeeName: emp.name,
    leaveType: body.leaveType,
    fromDate: body.fromDate,
    toDate: body.toDate,
    reason,
    status: 'pending',
    adminNotes: '',
    compOffWorkDate: body.compOffWorkDate ?? null,
    createdAt: ts,
    updatedAt: ts,
  });
}

export async function patchLeaveRequest(
  db: Db,
  ctx: RequestContext,
  id: string,
  updates: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  const set: Record<string, unknown> = { updatedAt: nowIso() };
  for (const key of [
    'status',
    'reviewedBy',
    'reviewedById',
    'reviewedAt',
    'adminNotes',
    'fromDate',
    'toDate',
    'leaveType',
    'reason',
    'compOffWorkDate',
  ] as const) {
    if (updates[key] !== undefined) set[key] = updates[key];
  }
  await db.update(leaveRequests).set(set).where(eq(leaveRequests.id, id));
}

export async function deleteLeaveByIds(db: Db, ctx: RequestContext, ids: string[], relaxed: boolean): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  if (!ids.length) return;
  await db.delete(leaveRequests).where(inArray(leaveRequests.id, ids));
}

// ─── Food (non-RPC paths) ─────────────────────────────────────

async function upsertFoodRow(db: Db, selection: Record<string, unknown>): Promise<void> {
  await db
    .insert(employeeFoodSelections)
    .values({
      id: selection.id as string,
      employeeId: selection.employeeId as string,
      employeeName: (selection.employeeName as string) ?? '',
      mealDate: selection.mealDate as string,
      breakfast: Boolean(selection.breakfast),
      lunch: Boolean(selection.lunch),
      dinner: Boolean(selection.dinner),
      submittedAt: (selection.submittedAt as string | null) ?? null,
      createdAt: (selection.createdAt as string) ?? nowIso(),
      updatedAt: (selection.updatedAt as string) ?? nowIso(),
    })
    .onConflictDoUpdate({
      target: [employeeFoodSelections.employeeId, employeeFoodSelections.mealDate],
      set: {
        employeeName: (selection.employeeName as string) ?? '',
        breakfast: Boolean(selection.breakfast),
        lunch: Boolean(selection.lunch),
        dinner: Boolean(selection.dinner),
        submittedAt: (selection.submittedAt as string | null) ?? null,
        updatedAt: (selection.updatedAt as string) ?? nowIso(),
      },
    });
}

export async function upsertFoodSelection(
  db: Db,
  ctx: RequestContext,
  selection: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  await upsertFoodRow(db, selection);
}

export async function adminSubmitFood(
  db: Db,
  ctx: RequestContext,
  selection: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  await upsertFoodRow(db, selection);
}

export type FoodSelectionRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  mealDate: string;
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Port of submit_own_food_meals — employee id from auth context only. */
export async function submitOwnFoodMeals(
  db: Db,
  ctx: RequestContext,
  body: { mealDate: string; breakfast?: boolean; lunch?: boolean; dinner?: boolean },
  relaxed: boolean,
): Promise<FoodSelectionRow> {
  const employeeId = requireMappedEmployeeId(ctx, relaxed);
  const empRows = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  const emp = empRows[0];
  if (!emp) throw new AuthError('Your login is not linked to an employee record. Log out and log in again.', 403);

  const breakfast = Boolean(body.breakfast);
  const lunch = Boolean(body.lunch);
  const dinner = Boolean(body.dinner);
  if (!breakfast && !lunch && !dinner) {
    throw new AuthError('Select at least one meal.', 400);
  }

  const existing = await db
    .select()
    .from(employeeFoodSelections)
    .where(
      and(
        eq(employeeFoodSelections.employeeId, emp.id),
        eq(employeeFoodSelections.mealDate, body.mealDate),
      ),
    )
    .limit(1);

  const ts = nowIso();
  if (existing[0]?.submittedAt) {
    throw new AuthError('Meals for this day are already submitted and cannot be changed.', 409);
  }

  if (existing[0]) {
    await db
      .update(employeeFoodSelections)
      .set({
        breakfast,
        lunch,
        dinner,
        submittedAt: ts,
        employeeName: emp.name,
        updatedAt: ts,
      })
      .where(eq(employeeFoodSelections.id, existing[0].id));
    return {
      id: existing[0].id,
      employeeId: emp.id,
      employeeName: emp.name,
      mealDate: body.mealDate,
      breakfast,
      lunch,
      dinner,
      submittedAt: ts,
      createdAt: existing[0].createdAt,
      updatedAt: ts,
    };
  }

  const id = crypto.randomUUID();
  await db.insert(employeeFoodSelections).values({
    id,
    employeeId: emp.id,
    employeeName: emp.name,
    mealDate: body.mealDate,
    breakfast,
    lunch,
    dinner,
    submittedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  });
  return {
    id,
    employeeId: emp.id,
    employeeName: emp.name,
    mealDate: body.mealDate,
    breakfast,
    lunch,
    dinner,
    submittedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  };
}

// ─── Petrol ───────────────────────────────────────────────────

function petrolAmountMinor(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export async function insertPetrolRequest(
  db: Db,
  ctx: RequestContext,
  req: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  const employeeId = req.employeeId as string;
  assertPetrolWrite(ctx, employeeId, relaxed);
  if (req.status === 'pending' || req.status === 'issued') {
    const open = await db
      .select({ id: petrolRequests.id })
      .from(petrolRequests)
      .where(
        and(
          eq(petrolRequests.employeeId, employeeId),
          or(eq(petrolRequests.status, 'pending'), eq(petrolRequests.status, 'issued')),
        ),
      )
      .limit(1);
    if (open.length) throw new Error('Employee already has an open petrol request');
  }
  const ts = nowIso();
  await db.insert(petrolRequests).values({
    id: req.id as string,
    employeeId,
    employeeName: (req.employeeName as string) ?? '',
    vehicleNo: (req.vehicleNo as string) ?? '',
    amountMinor: petrolAmountMinor(req.amount as number),
    requestedAt: req.requestedAt as string,
    status: (req.status as string) ?? 'pending',
    bookNo: (req.bookNo as string) ?? '',
    tokenNo: (req.tokenNo as string) ?? '',
    issuedBy: (req.issuedBy as string | null) ?? null,
    issuedById: (req.issuedById as string | null) ?? null,
    issuedAt: (req.issuedAt as string | null) ?? null,
    kms: req.kms == null ? null : Number(req.kms),
    receiptUrl: (req.receiptUrl as string) ?? '',
    kmsPhotoUrl: (req.kmsPhotoUrl as string) ?? '',
    receiptSubmittedAt: (req.receiptSubmittedAt as string | null) ?? null,
    notes: (req.notes as string) ?? '',
    adminNotes: (req.adminNotes as string) ?? '',
    createdAt: (req.createdAt as string) ?? ts,
    updatedAt: (req.updatedAt as string) ?? ts,
  });
}

export async function patchPetrolRequest(
  db: Db,
  ctx: RequestContext,
  id: string,
  updates: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  const rows = await db
    .select({ employeeId: petrolRequests.employeeId })
    .from(petrolRequests)
    .where(eq(petrolRequests.id, id))
    .limit(1);
  if (!rows.length) throw new AuthError('Not found', 404);
  assertPetrolWrite(ctx, rows[0].employeeId, relaxed);
  const set: Record<string, unknown> = { updatedAt: (updates.updatedAt as string) ?? nowIso() };
  if (updates.amount !== undefined) set.amountMinor = petrolAmountMinor(updates.amount as number);
  if (updates.vehicleNo !== undefined) set.vehicleNo = updates.vehicleNo;
  if (updates.status !== undefined) set.status = updates.status;
  if (updates.bookNo !== undefined) set.bookNo = updates.bookNo;
  if (updates.tokenNo !== undefined) set.tokenNo = updates.tokenNo;
  if (updates.issuedBy !== undefined) set.issuedBy = updates.issuedBy;
  if (updates.issuedById !== undefined) set.issuedById = updates.issuedById;
  if (updates.issuedAt !== undefined) set.issuedAt = updates.issuedAt;
  if (updates.kms !== undefined) set.kms = updates.kms;
  if (updates.receiptUrl !== undefined) set.receiptUrl = updates.receiptUrl;
  if (updates.kmsPhotoUrl !== undefined) set.kmsPhotoUrl = updates.kmsPhotoUrl;
  if (updates.receiptSubmittedAt !== undefined) set.receiptSubmittedAt = updates.receiptSubmittedAt;
  if (updates.notes !== undefined) set.notes = updates.notes;
  if (updates.adminNotes !== undefined) set.adminNotes = updates.adminNotes;
  await db.update(petrolRequests).set(set).where(eq(petrolRequests.id, id));
}

export async function deletePetrolRequest(db: Db, ctx: RequestContext, id: string, relaxed: boolean): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  await db.delete(petrolRequests).where(eq(petrolRequests.id, id));
}

export async function deleteAllPetrolRequests(db: Db, ctx: RequestContext, relaxed: boolean): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  await db.delete(petrolRequests).where(ne(petrolRequests.id, '00000000-0000-0000-0000-000000000000'));
}

// ─── Location trips ───────────────────────────────────────────

export async function insertLocationTrip(
  db: Db,
  ctx: RequestContext,
  trip: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  const employeeId = trip.employeeId as string;
  assertEmployeeSelfOrAdmin(ctx, employeeId, relaxed);
  if (trip.status === 'started') {
    const open = await db
      .select({ id: locationTrips.id })
      .from(locationTrips)
      .where(and(eq(locationTrips.employeeId, employeeId), eq(locationTrips.status, 'started')))
      .limit(1);
    if (open.length) throw new Error('Employee already has a started trip');
  }
  const ts = nowIso();
  await db.insert(locationTrips).values({
    id: trip.id as string,
    employeeId,
    employeeName: (trip.employeeName as string) ?? '',
    tripNo: Number(trip.tripNo ?? 0),
    notes: (trip.notes as string) ?? '',
    status: (trip.status as string) ?? 'started',
    startAt: trip.startAt as string,
    startLat: Number(trip.startLat ?? 0),
    startLng: Number(trip.startLng ?? 0),
    startAccuracyM: Number(trip.startAccuracyM ?? 0),
    startPlusCode: (trip.startPlusCode as string) ?? '',
    endAt: (trip.endAt as string | null) ?? null,
    endLat: trip.endLat == null ? null : Number(trip.endLat),
    endLng: trip.endLng == null ? null : Number(trip.endLng),
    endAccuracyM: trip.endAccuracyM == null ? null : Number(trip.endAccuracyM),
    endPlusCode: (trip.endPlusCode as string) ?? '',
    distanceKm: Number(trip.distanceKm ?? 0),
    bikeKm: trip.bikeKm == null ? null : Number(trip.bikeKm),
    bikeMinutes: trip.bikeMinutes == null ? null : Number(trip.bikeMinutes),
    bikeSource: (trip.bikeSource as string) ?? '',
    bikeMode: (trip.bikeMode as string) ?? '',
    fromName: (trip.fromName as string) ?? '',
    fromAddress: (trip.fromAddress as string) ?? '',
    fromEloc: (trip.fromEloc as string) ?? '',
    fromLat: trip.fromLat == null ? null : Number(trip.fromLat),
    fromLng: trip.fromLng == null ? null : Number(trip.fromLng),
    hospitalName: (trip.hospitalName as string) ?? '',
    hospitalAddress: (trip.hospitalAddress as string) ?? '',
    hospitalEloc: (trip.hospitalEloc as string) ?? '',
    hospitalLat: trip.hospitalLat == null ? null : Number(trip.hospitalLat),
    hospitalLng: trip.hospitalLng == null ? null : Number(trip.hospitalLng),
    createdAt: (trip.createdAt as string) ?? ts,
    updatedAt: (trip.updatedAt as string) ?? ts,
  });
}

export async function patchLocationTrip(
  db: Db,
  ctx: RequestContext,
  id: string,
  updates: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  const rows = await db
    .select({ employeeId: locationTrips.employeeId })
    .from(locationTrips)
    .where(eq(locationTrips.id, id))
    .limit(1);
  if (!rows.length) throw new AuthError('Not found', 404);
  assertEmployeeSelfOrAdmin(ctx, rows[0].employeeId, relaxed);
  const set: Record<string, unknown> = {};
  for (const key of [
    'notes',
    'status',
    'endAt',
    'endLat',
    'endLng',
    'endAccuracyM',
    'endPlusCode',
    'distanceKm',
    'bikeKm',
    'bikeMinutes',
    'bikeSource',
    'bikeMode',
    'fromName',
    'fromAddress',
    'fromEloc',
    'fromLat',
    'fromLng',
    'hospitalName',
    'hospitalAddress',
    'hospitalEloc',
    'hospitalLat',
    'hospitalLng',
    'updatedAt',
  ] as const) {
    if (updates[key] !== undefined) set[key] = updates[key];
  }
  if (!Object.keys(set).length) return;
  if (!set.updatedAt) set.updatedAt = nowIso();
  await db.update(locationTrips).set(set).where(eq(locationTrips.id, id));
}

export async function deleteLocationTrip(db: Db, ctx: RequestContext, id: string, relaxed: boolean): Promise<void> {
  assertAdminWrite(ctx, relaxed);
  await db.delete(locationTrips).where(eq(locationTrips.id, id));
}

// ─── Case task requests ───────────────────────────────────────

export async function createCaseTaskRequest(
  db: Db,
  ctx: RequestContext,
  req: Record<string, unknown>,
  relaxed: boolean,
): Promise<void> {
  const employeeId = req.employeeId as string;
  assertEmployeeSelfOrAdmin(ctx, employeeId, relaxed);
  if (req.status === 'pending') {
    const dup = await db
      .select({ id: caseTaskRequests.id })
      .from(caseTaskRequests)
      .where(
        and(
          eq(caseTaskRequests.caseId, req.caseId as string),
          eq(caseTaskRequests.employeeId, employeeId),
          eq(caseTaskRequests.status, 'pending'),
        ),
      )
      .limit(1);
    if (dup.length) throw new Error('Pending case task request already exists');
  }
  await db.insert(caseTaskRequests).values({
    id: req.id as string,
    caseId: req.caseId as string,
    caseNumber: req.caseNumber as string,
    stage: req.stage as string,
    employeeId,
    employeeName: (req.employeeName as string) ?? '',
    employeeDepartment: (req.employeeDepartment as string) ?? '',
    status: (req.status as string) ?? 'pending',
    requestedAt: req.requestedAt as string,
    reviewedBy: null,
    reviewedById: null,
    reviewedAt: null,
    adminNotes: null,
  });
}

export async function updateCaseTaskStatus(
  db: Db,
  ctx: RequestContext,
  id: string,
  status: string,
  reviewed: { reviewedBy: string; reviewedById: string; adminNotes?: string },
  relaxed: boolean,
): Promise<void> {
  assertCaseTaskAdmin(ctx, relaxed);
  await db
    .update(caseTaskRequests)
    .set({
      status,
      reviewedBy: reviewed.reviewedBy,
      reviewedById: reviewed.reviewedById,
      reviewedAt: nowIso(),
      adminNotes: reviewed.adminNotes ?? null,
    })
    .where(eq(caseTaskRequests.id, id));
}

export async function resolvePendingCaseTasks(
  db: Db,
  ctx: RequestContext,
  body: {
    caseId: string;
    approvedRequestId: string | null;
    assignedEmployeeId: string | null;
    reviewed: { reviewedBy: string; reviewedById: string; adminNotes?: string };
  },
  relaxed: boolean,
): Promise<void> {
  assertCaseTaskAdmin(ctx, relaxed);
  const pending = await db
    .select()
    .from(caseTaskRequests)
    .where(and(eq(caseTaskRequests.caseId, body.caseId), eq(caseTaskRequests.status, 'pending')));
  const reviewedAt = nowIso();
  for (const r of pending) {
    const approved = body.approvedRequestId
      ? r.id === body.approvedRequestId
      : body.assignedEmployeeId != null && r.employeeId === body.assignedEmployeeId;
    await db
      .update(caseTaskRequests)
      .set({
        status: approved ? 'approved' : 'rejected',
        reviewedBy: body.reviewed.reviewedBy,
        reviewedById: body.reviewed.reviewedById,
        reviewedAt,
        adminNotes: approved
          ? body.reviewed.adminNotes ?? 'Assigned by admin.'
          : 'Another employee was selected for this case.',
      })
      .where(eq(caseTaskRequests.id, r.id));
  }
}
