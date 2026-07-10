-- Auto-generated employee bootstrap
-- Source CSV rows: 5
-- Prerequisite: auth users must exist (run scripts/create-auth-users.mjs first, or add users in Supabase Dashboard)

-- Confirm all auth users
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email IN (
  'jeevanakarsh@gmail.com',
  'Preethamtailam@gmail.com',
  'ramakanth@gmail.com',
  'rachitha@gmail.com',
  'venkatesh@gmail.com'
);

-- Jeevan Akarsh (jeevanakarsh@gmail.com)
INSERT INTO employees (
  name, email, department, role, status, avatar, phone,
  cases_completed, cases_active, join_date, auth_user_id
)
SELECT
  'Jeevan Akarsh',
  'jeevanakarsh@gmail.com',
  'Stores',
  'admin',
  'Active',
  'JA',
  '80199711125',
  0, 0, CURRENT_DATE, u.id
FROM auth.users u
WHERE u.email = 'jeevanakarsh@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  role = EXCLUDED.role,
  status = 'Active',
  auth_user_id = EXCLUDED.auth_user_id;

-- Preetham Tailam (Preethamtailam@gmail.com)
INSERT INTO employees (
  name, email, department, role, status, avatar, phone,
  cases_completed, cases_active, join_date, auth_user_id
)
SELECT
  'Preetham Tailam',
  'Preethamtailam@gmail.com',
  'Stores',
  'admin',
  'Active',
  'PT',
  '80199711125',
  0, 0, CURRENT_DATE, u.id
FROM auth.users u
WHERE u.email = 'Preethamtailam@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  role = EXCLUDED.role,
  status = 'Active',
  auth_user_id = EXCLUDED.auth_user_id;

-- Ramakanth (ramakanth@gmail.com)
INSERT INTO employees (
  name, email, department, role, status, avatar, phone,
  cases_completed, cases_active, join_date, auth_user_id
)
SELECT
  'Ramakanth',
  'ramakanth@gmail.com',
  'Stores',
  'admin',
  'Active',
  'R',
  '80199711125',
  0, 0, CURRENT_DATE, u.id
FROM auth.users u
WHERE u.email = 'ramakanth@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  role = EXCLUDED.role,
  status = 'Active',
  auth_user_id = EXCLUDED.auth_user_id;

-- Rachitha (rachitha@gmail.com)
INSERT INTO employees (
  name, email, department, role, status, avatar, phone,
  cases_completed, cases_active, join_date, auth_user_id
)
SELECT
  'Rachitha',
  'rachitha@gmail.com',
  'Accounts',
  'employee',
  'Active',
  'R',
  '80199711125',
  0, 0, CURRENT_DATE, u.id
FROM auth.users u
WHERE u.email = 'rachitha@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  role = EXCLUDED.role,
  status = 'Active',
  auth_user_id = EXCLUDED.auth_user_id;

-- Venkatesh (venkatesh@gmail.com)
INSERT INTO employees (
  name, email, department, role, status, avatar, phone,
  cases_completed, cases_active, join_date, auth_user_id
)
SELECT
  'Venkatesh',
  'venkatesh@gmail.com',
  'Accounts',
  'employee',
  'Active',
  'V',
  '80199711125',
  0, 0, CURRENT_DATE, u.id
FROM auth.users u
WHERE u.email = 'venkatesh@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  role = EXCLUDED.role,
  status = 'Active',
  auth_user_id = EXCLUDED.auth_user_id;
