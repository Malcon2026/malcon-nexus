import { internalMutation, mutation } from './_generated/server';
import { v } from 'convex/values';
import { pkForTable, upsertRow } from './lib/rows';

/** Batch upsert from JSONL migration script (idempotent by table + legacyId). */
export const importBatch = internalMutation({
  args: {
    table: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, { table, rows }) => {
    let n = 0;
    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      pkForTable(table, row);
      await upsertRow(ctx.db, table, row);
      n++;
    }
    return { imported: n };
  },
});

/** CLI migration entry (run via scripts/migrate-to-convex.mjs). */
export const importBatchPublic = mutation({
  args: {
    table: v.string(),
    rows: v.array(v.any()),
    migrationKey: v.string(),
  },
  handler: async (ctx, { table, rows, migrationKey }) => {
    const expected = process.env.CONVEX_MIGRATION_KEY;
    if (!expected || migrationKey !== expected) {
      throw new Error('Invalid migration key');
    }
    let n = 0;
    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      pkForTable(table, row);
      await upsertRow(ctx.db, table, row);
      n++;
    }
    return { imported: n };
  },
});

/** Clear one logical table before full re-import. */
export const clearTable = internalMutation({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    const docs = await ctx.db
      .query('malconRows')
      .withIndex('by_table', (q) => q.eq('table', table))
      .collect();
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: docs.length };
  },
});
