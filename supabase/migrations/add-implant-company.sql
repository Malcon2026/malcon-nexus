-- Add "Implant Company" (manufacturer/brand) as its own field on cases.
-- "Implant Required" is relabeled "Surgery" in the UI only — no column rename,
-- so existing data and exports keep working without a backfill.
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS implant_company TEXT NOT NULL DEFAULT '';

COMMIT;
