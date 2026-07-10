-- Test admin account bootstrap
-- Step 1: Supabase Dashboard → Authentication → Users → Add user
--   Email:    testadmin@gmail.com
--   Password: TestAdmin@001
--   ✓ Auto Confirm User
-- Step 2: Run this SQL in SQL Editor

UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email = 'testadmin@gmail.com';

INSERT INTO employees (
  name,
  email,
  department,
  role,
  status,
  avatar,
  phone,
  cases_completed,
  cases_active,
  join_date,
  auth_user_id
)
SELECT
  'Test Admin',
  'testadmin@gmail.com',
  'Admin',
  'admin',
  'Active',
  'TA',
  '+91 9000000001',
  0,
  0,
  CURRENT_DATE,
  u.id
FROM auth.users u
WHERE u.email = 'testadmin@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  department = 'Admin',
  role = 'admin',
  status = 'Active',
  auth_user_id = EXCLUDED.auth_user_id;
