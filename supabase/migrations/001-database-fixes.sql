-- Run once in Supabase SQL Editor (Database → SQL → New query)

-- 1. Hospital branch column (required by Add Hospital form)
ALTER TABLE hospitals
ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT '';

-- 2. Let employees create approval rows when submitting work
DROP POLICY IF EXISTS "approvals_employee_insert" ON approvals;
CREATE POLICY "approvals_employee_insert" ON approvals
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = approvals.case_id
      AND cases.assigned_employee_id = current_employee_id()
  )
);

-- 3. Let admins read all notifications (approval alerts)
DROP POLICY IF EXISTS "notifications_admin_all" ON notifications;
CREATE POLICY "notifications_admin_all" ON notifications
FOR ALL
USING (current_user_role() = 'admin');
