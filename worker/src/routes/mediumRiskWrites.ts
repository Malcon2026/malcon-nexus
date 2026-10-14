import type { Env } from '../env';
import { createDb } from '../db/client';
import { apiData, apiError, isUuidLike } from '../lib/http';
import { writeRelaxed } from '../lib/writeContext';
import type { RequestContext } from '../middleware/auth';
import {
  createDoctor,
  createEmployee,
  createHospital,
  deleteDoctor,
  deleteEmployee,
  deleteHospital,
  linkAuthUserForSession,
  updateDoctor,
  updateEmployee,
  updateHospital,
} from '../services/mediumRisk/employeeReferenceWrites';
import {
  adminSubmitFood,
  createCaseTaskRequest,
  deleteAllPetrolRequests,
  deleteAttendanceApprovalsByIds,
  deleteAttendanceByIds,
  deleteLeaveByIds,
  deleteLocationTrip,
  deletePetrolRequest,
  insertAttendanceApproval,
  insertAttendanceRecord,
  insertLocationTrip,
  insertPetrolRequest,
  patchAttendanceApproval,
  patchAttendanceRecord,
  patchFieldTeamAttendance,
  patchLeaveRequest,
  patchLocationTrip,
  patchPetrolRequest,
  resolvePendingCaseTasks,
  submitOwnFoodMeals,
  submitOwnLeave,
  updateCaseTaskStatus,
  upsertFieldTeamAttendance,
  upsertFoodSelection,
} from '../services/mediumRisk/operationsMediumWrites';
import { mapWriteError, readJson } from './writeHelpers';

async function run(handler: () => Promise<void>, okStatus = 200): Promise<Response> {
  try {
    await handler();
    return apiData({ ok: true }, okStatus);
  } catch (e) {
    return mapWriteError(e);
  }
}

function requireUuid(id: string, label: string): Response | null {
  if (!isUuidLike(id)) return apiError('BAD_REQUEST', `Invalid ${label}`, 400);
  return null;
}

export async function handlePostEmployee(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<Parameters<typeof createEmployee>[2]>(request);
  if (body instanceof Response) return body;
  const bad = requireUuid(body.id, 'employee id');
  if (bad) return bad;
  const db = createDb(env);
  return run(() => createEmployee(db, ctx, body, writeRelaxed(env)), 201);
}

export async function handlePutEmployee(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  const bad = requireUuid(id, 'employee id');
  if (bad) return bad;
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => updateEmployee(db, ctx, id, body, writeRelaxed(env)));
}

export async function handleDeleteEmployee(_request: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  const bad = requireUuid(id, 'employee id');
  if (bad) return bad;
  const db = createDb(env);
  return run(() => deleteEmployee(db, ctx, id, writeRelaxed(env)));
}

export async function handlePostHospital(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<Parameters<typeof createHospital>[2]>(request);
  if (body instanceof Response) return body;
  const bad = requireUuid(body.id, 'hospital id');
  if (bad) return bad;
  const db = createDb(env);
  return run(() => createHospital(db, ctx, body, writeRelaxed(env)), 201);
}

export async function handlePutHospital(request: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  const bad = requireUuid(id, 'hospital id');
  if (bad) return bad;
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => updateHospital(db, ctx, id, body, writeRelaxed(env)));
}

export async function handleDeleteHospital(_request: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  const bad = requireUuid(id, 'hospital id');
  if (bad) return bad;
  const db = createDb(env);
  return run(() => deleteHospital(db, ctx, id, writeRelaxed(env)));
}

export async function handlePostDoctor(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<Parameters<typeof createDoctor>[2]>(request);
  if (body instanceof Response) return body;
  const bad = requireUuid(body.id, 'doctor id');
  if (bad) return bad;
  const db = createDb(env);
  return run(() => createDoctor(db, ctx, body, writeRelaxed(env)), 201);
}

export async function handlePutDoctor(request: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  const bad = requireUuid(id, 'doctor id');
  if (bad) return bad;
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => updateDoctor(db, ctx, id, body, writeRelaxed(env)));
}

export async function handleDeleteDoctor(_request: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  const bad = requireUuid(id, 'doctor id');
  if (bad) return bad;
  const db = createDb(env);
  return run(() => deleteDoctor(db, ctx, id, writeRelaxed(env)));
}

export async function handlePostAttendanceRecord(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const bad = requireUuid(body.id as string, 'attendance id');
  if (bad) return bad;
  const db = createDb(env);
  return run(() => insertAttendanceRecord(db, ctx, body, writeRelaxed(env)), 201);
}

export async function handlePatchAttendanceRecord(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  const bad = requireUuid(id, 'attendance id');
  if (bad) return bad;
  const body = await readJson<{ selfieUrl?: string }>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => patchAttendanceRecord(db, ctx, id, body, writeRelaxed(env)));
}

export async function handleBatchDeleteAttendance(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<{ ids?: string[] }>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => deleteAttendanceByIds(db, ctx, body.ids ?? [], writeRelaxed(env)));
}

export async function handlePostAttendanceApproval(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => insertAttendanceApproval(db, ctx, body, writeRelaxed(env)), 201);
}

export async function handlePatchAttendanceApproval(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  const bad = requireUuid(id, 'approval id');
  if (bad) return bad;
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => patchAttendanceApproval(db, ctx, id, body, writeRelaxed(env)));
}

export async function handleBatchDeleteAttendanceApprovals(
  request: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  const body = await readJson<{ ids?: string[] }>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => deleteAttendanceApprovalsByIds(db, ctx, body.ids ?? [], writeRelaxed(env)));
}

export async function handlePutFieldTeamAttendance(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => upsertFieldTeamAttendance(db, ctx, body, writeRelaxed(env)));
}

export async function handlePatchFieldTeamAttendance(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  const bad = requireUuid(id, 'field team id');
  if (bad) return bad;
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => patchFieldTeamAttendance(db, ctx, id, body, writeRelaxed(env)));
}

export async function handlePatchLeaveRequest(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  const bad = requireUuid(id, 'leave id');
  if (bad) return bad;
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => patchLeaveRequest(db, ctx, id, body, writeRelaxed(env)));
}

export async function handleBatchDeleteLeave(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<{ ids?: string[] }>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => deleteLeaveByIds(db, ctx, body.ids ?? [], writeRelaxed(env)));
}

export async function handlePostLeaveSubmitOwn(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<{
    id?: string;
    leaveType?: string;
    fromDate?: string;
    toDate?: string;
    reason?: string;
    compOffWorkDate?: string | null;
  }>(request);
  if (body instanceof Response) return body;
  if (!body.leaveType || !body.fromDate || !body.toDate || body.reason === undefined) {
    return apiError('BAD_REQUEST', 'leaveType, fromDate, toDate, and reason are required', 400);
  }
  const db = createDb(env);
  return run(() =>
    submitOwnLeave(
      db,
      ctx,
      {
        id: body.id,
        leaveType: body.leaveType,
        fromDate: body.fromDate,
        toDate: body.toDate,
        reason: body.reason,
        compOffWorkDate: body.compOffWorkDate,
      },
      writeRelaxed(env),
    ),
  201);
}

export async function handlePostFoodSubmitOwn(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<{
    mealDate?: string;
    breakfast?: boolean;
    lunch?: boolean;
    dinner?: boolean;
  }>(request);
  if (body instanceof Response) return body;
  if (!body.mealDate) return apiError('BAD_REQUEST', 'mealDate is required', 400);
  const db = createDb(env);
  try {
    const row = await submitOwnFoodMeals(
      db,
      ctx,
      {
        mealDate: body.mealDate,
        breakfast: body.breakfast,
        lunch: body.lunch,
        dinner: body.dinner,
      },
      writeRelaxed(env),
    );
    return apiData(row, 201);
  } catch (e) {
    return mapWriteError(e);
  }
}

export async function handlePostLinkAuthUser(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<{ employeeId?: string }>(request);
  if (body instanceof Response) return body;
  if (!body.employeeId || !isUuidLike(body.employeeId)) {
    return apiError('BAD_REQUEST', 'employeeId is required', 400);
  }
  const db = createDb(env);
  return run(() => linkAuthUserForSession(db, ctx, body.employeeId!, writeRelaxed(env)));
}

export async function handlePutFoodSelection(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  const bad = requireUuid(id, 'food selection id');
  if (bad) return bad;
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  if (body.id !== id) return apiError('BAD_REQUEST', 'Body id must match path id', 400);
  const db = createDb(env);
  return run(() => upsertFoodSelection(db, ctx, body, writeRelaxed(env)));
}

export async function handlePostFoodAdminSubmit(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => adminSubmitFood(db, ctx, body, writeRelaxed(env)), 201);
}

export async function handlePostPetrolRequest(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => insertPetrolRequest(db, ctx, body, writeRelaxed(env)), 201);
}

export async function handlePatchPetrolRequest(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  const bad = requireUuid(id, 'petrol id');
  if (bad) return bad;
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => patchPetrolRequest(db, ctx, id, body, writeRelaxed(env)));
}

export async function handleDeleteAllPetrol(_request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const db = createDb(env);
  return run(() => deleteAllPetrolRequests(db, ctx, writeRelaxed(env)));
}

export async function handleDeletePetrolRequest(_request: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  const bad = requireUuid(id, 'petrol id');
  if (bad) return bad;
  const db = createDb(env);
  return run(() => deletePetrolRequest(db, ctx, id, writeRelaxed(env)));
}

export async function handlePostLocationTrip(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => insertLocationTrip(db, ctx, body, writeRelaxed(env)), 201);
}

export async function handlePatchLocationTrip(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  const bad = requireUuid(id, 'trip id');
  if (bad) return bad;
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => patchLocationTrip(db, ctx, id, body, writeRelaxed(env)));
}

export async function handleDeleteLocationTrip(_request: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  const bad = requireUuid(id, 'trip id');
  if (bad) return bad;
  const db = createDb(env);
  return run(() => deleteLocationTrip(db, ctx, id, writeRelaxed(env)));
}

export async function handlePostCaseTaskRequest(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => createCaseTaskRequest(db, ctx, body, writeRelaxed(env)), 201);
}

export async function handlePatchCaseTaskStatus(
  request: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  const bad = requireUuid(id, 'case task id');
  if (bad) return bad;
  const body = await readJson<{
    status: string;
    reviewedBy: string;
    reviewedById: string;
    adminNotes?: string;
  }>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() =>
    updateCaseTaskStatus(db, ctx, id, body.status, body, writeRelaxed(env)),
  );
}

export async function handlePostResolveCaseTasks(request: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await readJson<Parameters<typeof resolvePendingCaseTasks>[2]>(request);
  if (body instanceof Response) return body;
  const db = createDb(env);
  return run(() => resolvePendingCaseTasks(db, ctx, body, writeRelaxed(env)));
}
