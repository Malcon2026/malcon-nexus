-- Punch-in selfie on attendance records (office + approved off-site in)
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS selfie_url TEXT;

COMMIT;
