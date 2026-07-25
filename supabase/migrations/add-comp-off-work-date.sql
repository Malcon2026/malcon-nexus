-- Comp Off leave requires the day the employee works (usually a Sunday).
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS comp_off_work_date DATE;

COMMENT ON COLUMN leave_requests.comp_off_work_date IS
  'For Comp Off leave: the date the employee works (or worked) in lieu of the leave day(s).';

COMMIT;
