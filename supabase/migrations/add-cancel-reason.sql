-- Track cancelled surgeries where unused implants must be returned and restocked.
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS cancel_reason TEXT NOT NULL DEFAULT '';

COMMIT;
