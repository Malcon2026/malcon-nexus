import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  attendanceApprovalRequests,
  employeeDailyExpenses,
  employeeFoodSelections,
  fieldTeamAttendanceApprovals,
  leaveRequests,
  locationTrips,
  petrolRequests,
} from '../db/schema';

function scopedWhere(employeeId: string | undefined, employeeCol: { employeeId: typeof leaveRequests.employeeId }): SQL | undefined {
  if (!employeeId) return undefined;
  return eq(employeeCol.employeeId, employeeId);
}

// ─── Attendance approval requests ───────────────────────────

const ATT_APPROVAL_COLS = {
  id: attendanceApprovalRequests.id,
  employeeId: attendanceApprovalRequests.employeeId,
  employeeName: attendanceApprovalRequests.employeeName,
  punchType: attendanceApprovalRequests.punchType,
  requestedAt: attendanceApprovalRequests.requestedAt,
  latitude: attendanceApprovalRequests.latitude,
  longitude: attendanceApprovalRequests.longitude,
  accuracyM: attendanceApprovalRequests.accuracyM,
  distanceM: attendanceApprovalRequests.distanceM,
  reason: attendanceApprovalRequests.reason,
  status: attendanceApprovalRequests.status,
  reviewedBy: attendanceApprovalRequests.reviewedBy,
  reviewedById: attendanceApprovalRequests.reviewedById,
  reviewedAt: attendanceApprovalRequests.reviewedAt,
  adminNotes: attendanceApprovalRequests.adminNotes,
  attendanceRecordId: attendanceApprovalRequests.attendanceRecordId,
  selfieUrl: attendanceApprovalRequests.selfieUrl,
  createdAt: attendanceApprovalRequests.createdAt,
} as const;

type AttApprovalRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  punchType: string;
  requestedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  distanceM: number;
  reason: string;
  status: string;
  reviewedBy: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  adminNotes: string | null;
  attendanceRecordId: string | null;
  selfieUrl: string | null;
  createdAt: string;
};

function mapAttApproval(row: AttApprovalRow) {
  return {
    id: row.id,
    employee_id: row.employeeId,
    employee_name: row.employeeName,
    punch_type: row.punchType,
    requested_at: row.requestedAt,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy_m: row.accuracyM,
    distance_m: row.distanceM,
    reason: row.reason,
    status: row.status,
    reviewed_by: row.reviewedBy,
    reviewed_by_id: row.reviewedById,
    reviewed_at: row.reviewedAt,
    admin_notes: row.adminNotes ?? '',
    attendance_record_id: row.attendanceRecordId,
    selfie_url: row.selfieUrl,
    created_at: row.createdAt,
  };
}

export async function countAttendanceApprovals(db: Db, employeeId?: string) {
  const where = scopedWhere(employeeId, attendanceApprovalRequests);
  const row = await db
    .select({ c: sql<number>`count(*)` })
    .from(attendanceApprovalRequests)
    .where(where);
  return Number(row[0]?.c ?? 0);
}

export async function listAttendanceApprovals(db: Db, employeeId: string | undefined, offset: number, limit: number) {
  const where = scopedWhere(employeeId, attendanceApprovalRequests);
  const rows = await db
    .select(ATT_APPROVAL_COLS)
    .from(attendanceApprovalRequests)
    .where(where)
    .orderBy(desc(attendanceApprovalRequests.requestedAt))
    .offset(offset)
    .limit(limit);
  return rows.map((r) => mapAttApproval(r));
}

// ─── Field team attendance ───────────────────────────────────

const FIELD_TEAM_COLS = {
  id: fieldTeamAttendanceApprovals.id,
  employeeId: fieldTeamAttendanceApprovals.employeeId,
  employeeName: fieldTeamAttendanceApprovals.employeeName,
  department: fieldTeamAttendanceApprovals.department,
  dateKey: fieldTeamAttendanceApprovals.dateKey,
  status: fieldTeamAttendanceApprovals.status,
  reviewedBy: fieldTeamAttendanceApprovals.reviewedBy,
  reviewedById: fieldTeamAttendanceApprovals.reviewedById,
  reviewedAt: fieldTeamAttendanceApprovals.reviewedAt,
  adminNotes: fieldTeamAttendanceApprovals.adminNotes,
  createdAt: fieldTeamAttendanceApprovals.createdAt,
  updatedAt: fieldTeamAttendanceApprovals.updatedAt,
} as const;

function mapFieldTeam(r: {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  dateKey: string;
  status: string;
  reviewedBy: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: r.id,
    employee_id: r.employeeId,
    employee_name: r.employeeName,
    department: r.department,
    date_key: r.dateKey,
    status: r.status,
    reviewed_by: r.reviewedBy,
    reviewed_by_id: r.reviewedById,
    reviewed_at: r.reviewedAt,
    admin_notes: r.adminNotes ?? '',
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function countFieldTeamAttendance(db: Db, dateKey?: string) {
  const where = dateKey ? eq(fieldTeamAttendanceApprovals.dateKey, dateKey) : undefined;
  const row = await db
    .select({ c: sql<number>`count(*)` })
    .from(fieldTeamAttendanceApprovals)
    .where(where);
  return Number(row[0]?.c ?? 0);
}

export async function listFieldTeamAttendance(
  db: Db,
  dateKey: string | undefined,
  offset: number,
  limit: number,
) {
  const where = dateKey ? eq(fieldTeamAttendanceApprovals.dateKey, dateKey) : undefined;
  const rows = await db
    .select(FIELD_TEAM_COLS)
    .from(fieldTeamAttendanceApprovals)
    .where(where)
    .orderBy(desc(fieldTeamAttendanceApprovals.dateKey))
    .offset(offset)
    .limit(limit);
  return rows.map(mapFieldTeam);
}

// ─── Leave ───────────────────────────────────────────────────

const LEAVE_COLS = {
  id: leaveRequests.id,
  employeeId: leaveRequests.employeeId,
  employeeName: leaveRequests.employeeName,
  leaveType: leaveRequests.leaveType,
  fromDate: leaveRequests.fromDate,
  toDate: leaveRequests.toDate,
  reason: leaveRequests.reason,
  status: leaveRequests.status,
  reviewedBy: leaveRequests.reviewedBy,
  reviewedById: leaveRequests.reviewedById,
  reviewedAt: leaveRequests.reviewedAt,
  adminNotes: leaveRequests.adminNotes,
  compOffWorkDate: leaveRequests.compOffWorkDate,
  createdAt: leaveRequests.createdAt,
  updatedAt: leaveRequests.updatedAt,
} as const;

function mapLeave(r: {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  reviewedBy: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  adminNotes: string;
  compOffWorkDate: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: r.id,
    employee_id: r.employeeId,
    employee_name: r.employeeName,
    leave_type: r.leaveType,
    from_date: r.fromDate,
    to_date: r.toDate,
    reason: r.reason,
    status: r.status,
    reviewed_by: r.reviewedBy,
    reviewed_by_id: r.reviewedById,
    reviewed_at: r.reviewedAt,
    admin_notes: r.adminNotes,
    comp_off_work_date: r.compOffWorkDate,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function countLeaveRequests(db: Db, employeeId?: string) {
  const where = scopedWhere(employeeId, leaveRequests);
  const row = await db.select({ c: sql<number>`count(*)` }).from(leaveRequests).where(where);
  return Number(row[0]?.c ?? 0);
}

export async function listLeaveRequests(db: Db, employeeId: string | undefined, offset: number, limit: number) {
  const where = scopedWhere(employeeId, leaveRequests);
  const rows = await db
    .select(LEAVE_COLS)
    .from(leaveRequests)
    .where(where)
    .orderBy(desc(leaveRequests.createdAt))
    .offset(offset)
    .limit(limit);
  return rows.map(mapLeave);
}

// ─── Petrol ──────────────────────────────────────────────────

const PETROL_COLS = {
  id: petrolRequests.id,
  employeeId: petrolRequests.employeeId,
  employeeName: petrolRequests.employeeName,
  vehicleNo: petrolRequests.vehicleNo,
  amountMinor: petrolRequests.amountMinor,
  requestedAt: petrolRequests.requestedAt,
  status: petrolRequests.status,
  bookNo: petrolRequests.bookNo,
  tokenNo: petrolRequests.tokenNo,
  issuedBy: petrolRequests.issuedBy,
  issuedById: petrolRequests.issuedById,
  issuedAt: petrolRequests.issuedAt,
  kms: petrolRequests.kms,
  receiptUrl: petrolRequests.receiptUrl,
  kmsPhotoUrl: petrolRequests.kmsPhotoUrl,
  receiptSubmittedAt: petrolRequests.receiptSubmittedAt,
  notes: petrolRequests.notes,
  adminNotes: petrolRequests.adminNotes,
  createdAt: petrolRequests.createdAt,
  updatedAt: petrolRequests.updatedAt,
} as const;

function mapPetrol(r: {
  id: string;
  employeeId: string;
  employeeName: string;
  vehicleNo: string;
  amountMinor: number;
  requestedAt: string;
  status: string;
  bookNo: string;
  tokenNo: string;
  issuedBy: string | null;
  issuedById: string | null;
  issuedAt: string | null;
  kms: number | null;
  receiptUrl: string;
  kmsPhotoUrl: string;
  receiptSubmittedAt: string | null;
  notes: string;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: r.id,
    employee_id: r.employeeId,
    employee_name: r.employeeName,
    vehicle_no: r.vehicleNo,
    amount: r.amountMinor / 100,
    requested_at: r.requestedAt,
    status: r.status,
    book_no: r.bookNo,
    token_no: r.tokenNo,
    issued_by: r.issuedBy,
    issued_by_id: r.issuedById,
    issued_at: r.issuedAt,
    kms: r.kms,
    kms_start: null,
    kms_end: null,
    receipt_url: r.receiptUrl,
    kms_photo_url: r.kmsPhotoUrl,
    receipt_submitted_at: r.receiptSubmittedAt,
    notes: r.notes,
    admin_notes: r.adminNotes,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function countPetrolRequests(db: Db, employeeId?: string) {
  const where = scopedWhere(employeeId, petrolRequests);
  const row = await db.select({ c: sql<number>`count(*)` }).from(petrolRequests).where(where);
  return Number(row[0]?.c ?? 0);
}

export async function listPetrolRequests(db: Db, employeeId: string | undefined, offset: number, limit: number) {
  const where = scopedWhere(employeeId, petrolRequests);
  const rows = await db
    .select(PETROL_COLS)
    .from(petrolRequests)
    .where(where)
    .orderBy(desc(petrolRequests.requestedAt))
    .offset(offset)
    .limit(limit);
  return rows.map(mapPetrol);
}

// ─── Location trips ────────────────────────────────────────────

const TRIP_COLS = {
  id: locationTrips.id,
  employeeId: locationTrips.employeeId,
  employeeName: locationTrips.employeeName,
  tripNo: locationTrips.tripNo,
  notes: locationTrips.notes,
  status: locationTrips.status,
  startAt: locationTrips.startAt,
  startLat: locationTrips.startLat,
  startLng: locationTrips.startLng,
  startAccuracyM: locationTrips.startAccuracyM,
  startPlusCode: locationTrips.startPlusCode,
  endAt: locationTrips.endAt,
  endLat: locationTrips.endLat,
  endLng: locationTrips.endLng,
  endAccuracyM: locationTrips.endAccuracyM,
  endPlusCode: locationTrips.endPlusCode,
  distanceKm: locationTrips.distanceKm,
  bikeKm: locationTrips.bikeKm,
  bikeMinutes: locationTrips.bikeMinutes,
  bikeSource: locationTrips.bikeSource,
  bikeMode: locationTrips.bikeMode,
  fromName: locationTrips.fromName,
  fromAddress: locationTrips.fromAddress,
  fromEloc: locationTrips.fromEloc,
  fromLat: locationTrips.fromLat,
  fromLng: locationTrips.fromLng,
  hospitalName: locationTrips.hospitalName,
  hospitalAddress: locationTrips.hospitalAddress,
  hospitalEloc: locationTrips.hospitalEloc,
  hospitalLat: locationTrips.hospitalLat,
  hospitalLng: locationTrips.hospitalLng,
  createdAt: locationTrips.createdAt,
  updatedAt: locationTrips.updatedAt,
} as const;

function mapTrip(r: Record<string, unknown>) {
  const row = r as {
    id: string;
    employeeId: string;
    employeeName: string;
    tripNo: number;
    notes: string;
    status: string;
    startAt: string;
    startLat: number;
    startLng: number;
    startAccuracyM: number;
    startPlusCode: string;
    endAt: string | null;
    endLat: number | null;
    endLng: number | null;
    endAccuracyM: number | null;
    endPlusCode: string;
    distanceKm: number;
    bikeKm: number | null;
    bikeMinutes: number | null;
    bikeSource: string;
    bikeMode: string;
    fromName: string;
    fromAddress: string;
    fromEloc: string;
    fromLat: number | null;
    fromLng: number | null;
    hospitalName: string;
    hospitalAddress: string;
    hospitalEloc: string;
    hospitalLat: number | null;
    hospitalLng: number | null;
    createdAt: string;
    updatedAt: string;
  };
  return {
    id: row.id,
    employee_id: row.employeeId,
    employee_name: row.employeeName,
    trip_no: row.tripNo,
    notes: row.notes,
    status: row.status,
    start_at: row.startAt,
    start_lat: row.startLat,
    start_lng: row.startLng,
    start_accuracy_m: row.startAccuracyM,
    start_plus_code: row.startPlusCode,
    end_at: row.endAt,
    end_lat: row.endLat,
    end_lng: row.endLng,
    end_accuracy_m: row.endAccuracyM,
    end_plus_code: row.endPlusCode,
    distance_km: row.distanceKm,
    bike_km: row.bikeKm,
    bike_minutes: row.bikeMinutes,
    bike_source: row.bikeSource,
    bike_mode: row.bikeMode,
    from_name: row.fromName,
    from_address: row.fromAddress,
    from_eloc: row.fromEloc,
    from_lat: row.fromLat,
    from_lng: row.fromLng,
    hospital_name: row.hospitalName,
    hospital_address: row.hospitalAddress,
    hospital_eloc: row.hospitalEloc,
    hospital_lat: row.hospitalLat,
    hospital_lng: row.hospitalLng,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function countLocationTrips(db: Db, employeeId?: string) {
  const where = scopedWhere(employeeId, locationTrips);
  const row = await db.select({ c: sql<number>`count(*)` }).from(locationTrips).where(where);
  return Number(row[0]?.c ?? 0);
}

export async function listLocationTrips(db: Db, employeeId: string | undefined, offset: number, limit: number) {
  const where = scopedWhere(employeeId, locationTrips);
  const rows = await db
    .select(TRIP_COLS)
    .from(locationTrips)
    .where(where)
    .orderBy(desc(locationTrips.startAt))
    .offset(offset)
    .limit(limit);
  return rows.map((r) => mapTrip(r));
}

// ─── Food selections ───────────────────────────────────────────

export type FoodListFilters = {
  employeeId?: string;
  fromDate?: string;
  toDate?: string;
};

function foodWhere(filters: FoodListFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.employeeId) parts.push(eq(employeeFoodSelections.employeeId, filters.employeeId));
  if (filters.fromDate) parts.push(gte(employeeFoodSelections.mealDate, filters.fromDate));
  if (filters.toDate) parts.push(lte(employeeFoodSelections.mealDate, filters.toDate));
  if (parts.length === 0) return undefined;
  return and(...parts);
}

const FOOD_COLS = {
  id: employeeFoodSelections.id,
  employeeId: employeeFoodSelections.employeeId,
  employeeName: employeeFoodSelections.employeeName,
  mealDate: employeeFoodSelections.mealDate,
  breakfast: employeeFoodSelections.breakfast,
  lunch: employeeFoodSelections.lunch,
  dinner: employeeFoodSelections.dinner,
  submittedAt: employeeFoodSelections.submittedAt,
  createdAt: employeeFoodSelections.createdAt,
  updatedAt: employeeFoodSelections.updatedAt,
} as const;

function mapFood(r: {
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
}) {
  return {
    id: r.id,
    employee_id: r.employeeId,
    employee_name: r.employeeName,
    meal_date: r.mealDate,
    breakfast: r.breakfast,
    lunch: r.lunch,
    dinner: r.dinner,
    submitted_at: r.submittedAt,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function countFoodSelections(db: Db, filters: FoodListFilters) {
  const where = foodWhere(filters);
  const row = await db.select({ c: sql<number>`count(*)` }).from(employeeFoodSelections).where(where);
  return Number(row[0]?.c ?? 0);
}

export async function listFoodSelections(db: Db, filters: FoodListFilters, offset: number, limit: number) {
  const where = foodWhere(filters);
  const rows = await db
    .select(FOOD_COLS)
    .from(employeeFoodSelections)
    .where(where)
    .orderBy(desc(employeeFoodSelections.mealDate))
    .offset(offset)
    .limit(limit);
  return rows.map(mapFood);
}

// ─── Daily expenses ────────────────────────────────────────────

const EXPENSE_COLS = {
  id: employeeDailyExpenses.id,
  employeeId: employeeDailyExpenses.employeeId,
  employeeName: employeeDailyExpenses.employeeName,
  expenseDate: employeeDailyExpenses.expenseDate,
  kmsDriven: employeeDailyExpenses.kmsDriven,
  petrolAmount: employeeDailyExpenses.petrolAmount,
  foodAmount: employeeDailyExpenses.foodAmount,
  otherAmount: employeeDailyExpenses.otherAmount,
  otherDescription: employeeDailyExpenses.otherDescription,
  notes: employeeDailyExpenses.notes,
  enteredBy: employeeDailyExpenses.enteredBy,
  enteredById: employeeDailyExpenses.enteredById,
  createdAt: employeeDailyExpenses.createdAt,
  updatedAt: employeeDailyExpenses.updatedAt,
} as const;

function mapExpense(r: {
  id: string;
  employeeId: string;
  employeeName: string;
  expenseDate: string;
  kmsDriven: number;
  petrolAmount: number;
  foodAmount: number;
  otherAmount: number;
  otherDescription: string;
  notes: string;
  enteredBy: string;
  enteredById: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: r.id,
    employee_id: r.employeeId,
    employee_name: r.employeeName,
    expense_date: r.expenseDate,
    kms_driven: r.kmsDriven,
    petrol_amount: r.petrolAmount,
    food_amount: r.foodAmount,
    other_amount: r.otherAmount,
    other_description: r.otherDescription,
    notes: r.notes,
    entered_by: r.enteredBy,
    entered_by_id: r.enteredById,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export async function countDailyExpenses(db: Db) {
  const row = await db.select({ c: sql<number>`count(*)` }).from(employeeDailyExpenses);
  return Number(row[0]?.c ?? 0);
}

export async function listDailyExpenses(db: Db, offset: number, limit: number) {
  const rows = await db
    .select(EXPENSE_COLS)
    .from(employeeDailyExpenses)
    .orderBy(desc(employeeDailyExpenses.expenseDate))
    .offset(offset)
    .limit(limit);
  return rows.map(mapExpense);
}
