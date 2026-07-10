-- Reset ALL users (employees + Supabase Auth accounts)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- Keeps hospitals, doctors, departments, kits intact.
-- Wipes cases, notifications, approvals, activity, employees, and auth users.

DELETE FROM activity_log;
DELETE FROM approvals;
DELETE FROM notifications;
DELETE FROM cases;
DELETE FROM employees;

-- Remove every Supabase Auth login
DELETE FROM auth.users;
