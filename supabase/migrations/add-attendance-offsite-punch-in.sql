-- Allow off-site punch-in approval requests (same rule as punch-out)
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE attendance_approval_requests
  DROP CONSTRAINT IF EXISTS attendance_approval_requests_punch_type_check;

ALTER TABLE attendance_approval_requests
  ADD CONSTRAINT attendance_approval_requests_punch_type_check
  CHECK (punch_type IN ('in', 'out'));

COMMIT;
