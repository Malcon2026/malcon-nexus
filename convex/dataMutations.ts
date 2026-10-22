import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { deleteRow, mergeRow, upsertRow } from './lib/rows';

export const upsertTableRow = internalMutation({
  args: { table: v.string(), row: v.any() },
  handler: async (ctx, { table, row }) => {
    await upsertRow(ctx.db, table, row as Record<string, unknown>);
    return { ok: true };
  },
});

export const mergeTableRow = internalMutation({
  args: { table: v.string(), legacyId: v.string(), patch: v.any() },
  handler: async (ctx, { table, legacyId, patch }) => {
    const row = await mergeRow(ctx.db, table, legacyId, patch as Record<string, unknown>);
    return { row };
  },
});

export const deleteTableRow = internalMutation({
  args: { table: v.string(), legacyId: v.string() },
  handler: async (ctx, { table, legacyId }) => {
    const ok = await deleteRow(ctx.db, table, legacyId);
    return { ok };
  },
});
