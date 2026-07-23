-- Add "Comp Off" as a valid leave_type value.
-- Already applied directly to the linked project (urupxpfydfrvjlkpqlvi) via
-- `supabase db query --linked` on 2026-07-23. Kept here for the migration
-- history / other environments.

BEGIN;

ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_leave_type_check
  CHECK (leave_type IN ('Casual', 'Sick', 'Unpaid', 'Comp Off'));

COMMIT;
