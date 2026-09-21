-- Store managers: team attendance register (read/write punches & leave for staff).

BEGIN;

DROP POLICY IF EXISTS "attendance_store_manager_all" ON attendance_records;
CREATE POLICY "attendance_store_manager_all" ON attendance_records
  FOR ALL USING (current_user_role() = 'store_manager');

DROP POLICY IF EXISTS "leave_store_manager_all" ON leave_requests;
CREATE POLICY "leave_store_manager_all" ON leave_requests
  FOR ALL USING (current_user_role() = 'store_manager');

DROP POLICY IF EXISTS "attendance_approval_store_manager_select" ON attendance_approval_requests;
CREATE POLICY "attendance_approval_store_manager_select" ON attendance_approval_requests
  FOR SELECT USING (current_user_role() = 'store_manager');

COMMIT;
