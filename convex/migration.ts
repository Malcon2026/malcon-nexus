import { internalMutation, internalQuery, mutation } from './_generated/server';
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

/** Cheap emptiness check (one indexed read). */
export const tableIsEmpty = internalQuery({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    const doc = await ctx.db
      .query('malconRows')
      .withIndex('by_table', (q) => q.eq('table', table))
      .first();
    return { empty: doc === null };
  },
});

/** Delete up to `limit` rows from one logical table (avoids mutation timeout on large tables). */
export const clearTableBatch = internalMutation({
  args: { table: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { table, limit: rawLimit }) => {
    const limit = Math.min(Math.max(rawLimit ?? 100, 1), 500);
    const docs = await ctx.db
      .query('malconRows')
      .withIndex('by_table', (q) => q.eq('table', table))
      .take(limit);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: docs.length, hasMore: docs.length === limit };
  },
});

/** CLI / script entry for batched table purge (see scripts/purge-convex-operational-data.mjs). */
export const clearTableBatchPublic = mutation({
  args: {
    table: v.string(),
    limit: v.optional(v.number()),
    migrationKey: v.string(),
  },
  handler: async (ctx, { table, limit, migrationKey }) => {
    const expected = process.env.CONVEX_MIGRATION_KEY;
    if (!expected || migrationKey !== expected) {
      throw new Error('Invalid migration key');
    }
    const cap = Math.min(Math.max(limit ?? 100, 1), 500);
    const docs = await ctx.db
      .query('malconRows')
      .withIndex('by_table', (q) => q.eq('table', table))
      .take(cap);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: docs.length, hasMore: docs.length === cap };
  },
});
