-- Track postponed surgeries (new date; kit stays where it is).
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS postpone_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS postponed_from DATE;

COMMIT;
