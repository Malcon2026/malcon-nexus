import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Operational rows migrated from D1/Postgres JSONL exports.
 * `row` holds snake_case columns matching worker/D1 shape.
 */
export default defineSchema({
  malconRows: defineTable({
    table: v.string(),
    legacyId: v.string(),
    row: v.any(),
  })
    .index('by_table_legacyId', ['table', 'legacyId'])
    .index('by_table', ['table']),
});
