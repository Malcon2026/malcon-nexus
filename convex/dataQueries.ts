import { internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { getRowByLegacyId, listTableRows, lookupEmployeeByAuthUserId } from './lib/rows';

export const listRows = internalQuery({
  args: {
    table: v.string(),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => listTableRows(ctx.db, args.table, args),
});

export const getRow = internalQuery({
  args: { table: v.string(), legacyId: v.string() },
  handler: async (ctx, { table, legacyId }) => getRowByLegacyId(ctx.db, table, legacyId),
});

export const employeeByAuthUserId = internalQuery({
  args: { authUserId: v.string() },
  handler: async (ctx, { authUserId }) => lookupEmployeeByAuthUserId(ctx.db, authUserId),
});
