import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { cases } from '../db/schema';

const MAX_EMPLOYEE_CASE_IDS = 300;
const MAX_FCFS_POOL_IDS = 150;

/** Cases where employee is primary assignee, on a stage, or legacy snapshot match. */
export async function listCaseIdsForEmployee(db: Db, employeeId: string, limit = MAX_EMPLOYEE_CASE_IDS) {
  const stageNeedle = `%${employeeId}%`;
  const rows = await db
    .select({ id: cases.id })
    .from(cases)
    .where(
      or(
        eq(cases.assignedEmployeeId, employeeId),
        sql`${cases.stages} LIKE ${stageNeedle}`,
        sql`json_extract(${cases.assignedEmployeeSnapshot}, '$.id') = ${employeeId}`,
      ),
    )
    .orderBy(desc(cases.updatedAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

/** Unassigned FCFS pool candidates (department filter applied in SPA). */
export async function listFcfsPoolCaseIds(db: Db, stages: string[], limit = MAX_FCFS_POOL_IDS) {
  if (stages.length === 0) return [];
  const rows = await db
    .select({
      id: cases.id,
      currentStage: cases.currentStage,
      currentDepartment: cases.currentDepartment,
      status: cases.status,
    })
    .from(cases)
    .where(
      and(
        isNull(cases.assignedEmployeeId),
        inArray(cases.status, ['Active', 'Draft']),
        inArray(cases.currentStage, stages),
      ),
    )
    .orderBy(desc(cases.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    current_stage: r.currentStage,
    current_department: r.currentDepartment,
    status: r.status,
  }));
}
