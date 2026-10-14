import type { Db } from '../db/client';
import { cases } from '../db/schema';
import { eq } from 'drizzle-orm';
import { parseStagesJson } from './caseAssignee';
import { nowIso } from './writeContext';

/** Port of public.sync_case_header_from_stages(p_case_id uuid) for non-admin employees. */
export async function syncCaseHeaderFromStages(db: Db, caseId: string): Promise<void> {
  const rows = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  const row = rows[0];
  if (!row) throw new Error('Case not found.');

  const stages = parseStagesJson(row.stages);
  let pickStage: string | null = null;
  let pickEmp: { id?: string; name?: string } | null = null;
  let pickStatus = 'Pending';

  for (const elem of stages) {
    const st = elem.stage ?? '';
    if (st === 'Completed') continue;
    if ((elem.status ?? 'Pending') === 'Approved') continue;
    pickStage = st;
    pickEmp = elem.assignedEmployee ?? null;
    pickStatus = elem.status ?? 'Pending';
    break;
  }

  if (!pickStage) {
    const restockApproved = stages.some((e) => e.stage === 'Restock' && e.status === 'Approved');
    if (restockApproved) {
      pickStage = 'Completed';
      pickEmp = null;
      pickStatus = 'Approved';
    } else {
      return;
    }
  }

  let status = row.status;
  if (pickStatus === 'Submitted') status = 'Waiting For Approval';
  else if (pickStatus === 'Changes Requested') status = 'Changes Requested';
  else if (pickStatus === 'Rejected') status = 'Rejected';
  else if (pickEmp) status = 'Active';

  await db
    .update(cases)
    .set({
      currentStage: pickStage,
      currentDepartment: null,
      assignedEmployeeId: pickEmp?.id?.trim() ? pickEmp.id : null,
      assignedEmployeeSnapshot: pickEmp ? JSON.stringify(pickEmp) : null,
      status,
      updatedAt: nowIso(),
    })
    .where(eq(cases.id, caseId));
}
