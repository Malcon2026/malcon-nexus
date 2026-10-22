import type { GenericDatabaseReader, GenericDatabaseWriter } from 'convex/server';
import type { DataModel } from '../_generated/dataModel';

type DbReader = GenericDatabaseReader<DataModel>;
type DbWriter = GenericDatabaseWriter<DataModel>;

export function pkForTable(table: string, row: Record<string, unknown>): string {
  if (table === 'app_settings') {
    const key = row.key;
    if (typeof key !== 'string' || !key) throw new Error(`app_settings row missing key`);
    return key;
  }
  const id = row.id;
  if (typeof id !== 'string' || !id) throw new Error(`${table} row missing id`);
  return id;
}

export async function listTableRows(
  db: DbReader,
  table: string,
  opts?: { offset?: number; limit?: number },
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const all = await db
    .query('malconRows')
    .withIndex('by_table', (q) => q.eq('table', table))
    .collect();
  const total = all.length;
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? total;
  const slice = all.slice(offset, offset + limit);
  return { items: slice.map((d) => d.row as Record<string, unknown>), total };
}

export async function getRowByLegacyId(
  db: DbReader,
  table: string,
  legacyId: string,
): Promise<Record<string, unknown> | null> {
  const doc = await db
    .query('malconRows')
    .withIndex('by_table_legacyId', (q) => q.eq('table', table).eq('legacyId', legacyId))
    .unique();
  return doc ? (doc.row as Record<string, unknown>) : null;
}

export async function upsertRow(
  db: DbWriter,
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  const legacyId = pkForTable(table, row);
  const existing = await db
    .query('malconRows')
    .withIndex('by_table_legacyId', (q) => q.eq('table', table).eq('legacyId', legacyId))
    .unique();
  if (existing) {
    await db.patch(existing._id, { row });
  } else {
    await db.insert('malconRows', { table, legacyId, row });
  }
}

export async function mergeRow(
  db: DbWriter,
  table: string,
  legacyId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const prev = (await getRowByLegacyId(db, table, legacyId)) ?? { id: legacyId };
  const next = { ...prev, ...patch, id: legacyId };
  await upsertRow(db, table, next);
  return next;
}

export async function deleteRow(db: DbWriter, table: string, legacyId: string): Promise<boolean> {
  const existing = await db
    .query('malconRows')
    .withIndex('by_table_legacyId', (q) => q.eq('table', table).eq('legacyId', legacyId))
    .unique();
  if (!existing) return false;
  await db.delete(existing._id);
  return true;
}

export async function lookupEmployeeByAuthUserId(
  db: DbReader,
  authUserId: string,
): Promise<Record<string, unknown> | null> {
  const all = await db
    .query('malconRows')
    .withIndex('by_table', (q) => q.eq('table', 'employees'))
    .collect();
  for (const doc of all) {
    const row = doc.row as Record<string, unknown>;
    if (row.auth_user_id === authUserId) return row;
  }
  return null;
}
