-- ============================================================
-- ImplantFlow — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 1. EMPLOYEES
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  department   TEXT NOT NULL CHECK (department IN (
    'Stores', 'Scrub Person', 'Cleaning Department',
    'Stores Audit', 'Accounts', 'Collection Executive', 'Admin'
  )),
  role         TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  status       TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  avatar       TEXT NOT NULL DEFAULT '',
  phone        TEXT NOT NULL DEFAULT '',
  cases_completed INT NOT NULL DEFAULT 0,
  cases_active    INT NOT NULL DEFAULT 0,
  join_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id ON employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);


-- ============================================================
-- 2. HOSPITALS
-- ============================================================
CREATE TABLE IF NOT EXISTS hospitals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  branch         TEXT NOT NULL DEFAULT '',
  address        TEXT NOT NULL DEFAULT '',
  city           TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL DEFAULT '',
  phone          TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);


-- ============================================================
-- 3. DOCTORS
-- ============================================================
CREATE TABLE IF NOT EXISTS doctors (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  specialization  TEXT NOT NULL DEFAULT '',
  hospital_id     UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  phone           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctors_hospital_id ON doctors(hospital_id);


-- ============================================================
-- 4. DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE CHECK (name IN (
    'Stores', 'Scrub Person', 'Cleaning Department',
    'Stores Audit', 'Accounts', 'Collection Executive', 'Admin'
  )),
  description TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT 'bg-gray-100 text-gray-800'
);


-- ============================================================
-- 5. SURGICAL KITS
-- ============================================================
CREATE TABLE IF NOT EXISTS surgical_kits (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT '',
  serial_number TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL DEFAULT 'Available' CHECK (status IN (
    'Available', 'Assigned', 'In Surgery', 'Cleaning', 'Audit', 'Completed'
  )),
  last_used_date DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 6. CASES
-- ============================================================
CREATE TABLE IF NOT EXISTS cases (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number         TEXT NOT NULL UNIQUE,
  hospital_id         UUID NOT NULL REFERENCES hospitals(id) ON DELETE RESTRICT,
  doctor_id           UUID REFERENCES doctors(id) ON DELETE SET NULL,
  hospital_snapshot   JSONB NOT NULL DEFAULT '{}',
  doctor_snapshot     JSONB NOT NULL DEFAULT '{}',
  surgery_date        DATE,
  implant_required    TEXT NOT NULL DEFAULT '',
  implant_type        TEXT NOT NULL DEFAULT '',
  priority            TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical','High','Medium','Low')),
  status              TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN (
    'Draft','Active','Waiting For Approval','Approved',
    'Rejected','Changes Requested','Completed','Cancelled'
  )),
  current_stage       TEXT NOT NULL DEFAULT 'Kit Preparation' CHECK (current_stage IN (
    'Kit Preparation','Surgery','Cleaning','Audit','Billing','Collection','Completed'
  )),
  current_department  TEXT CHECK (current_department IN (
    'Stores','Scrub Person','Cleaning Department','Stores Audit',
    'Accounts','Collection Executive','Admin'
  )),
  assigned_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_employee_snapshot JSONB DEFAULT NULL,
  created_by          TEXT NOT NULL DEFAULT '',
  due_date            DATE,
  remarks             TEXT NOT NULL DEFAULT '',
  stages              JSONB NOT NULL DEFAULT '[]',
  activity_logs       JSONB NOT NULL DEFAULT '[]',
  comments            JSONB NOT NULL DEFAULT '[]',
  invoice_amount      NUMERIC(12,2),
  collected_amount    NUMERIC(12,2),
  payment_status      TEXT CHECK (payment_status IN ('Pending','Partial','Collected')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_current_stage ON cases(current_stage);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_employee ON cases(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_cases_hospital_id ON cases(hospital_id);
CREATE INDEX IF NOT EXISTS idx_cases_surgery_date ON cases(surgery_date);


-- ============================================================
-- 7. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  message      TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  case_id      UUID REFERENCES cases(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);


-- ============================================================
-- 8. APPROVALS
-- ============================================================
CREATE TABLE IF NOT EXISTS approvals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id        UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  case_number    TEXT NOT NULL,
  stage          TEXT NOT NULL,
  submitted_by   TEXT NOT NULL,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at    TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN (
    'Pending','Approved','Rejected','Changes Requested'
  )),
  notes          TEXT,
  admin_notes    TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_case_id ON approvals(case_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);


-- ============================================================
-- 9. ACTIVITY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action            TEXT NOT NULL,
  entity_type       TEXT NOT NULL CHECK (entity_type IN (
    'case','employee','hospital','department','kit','system'
  )),
  entity_id         TEXT NOT NULL,
  entity_label      TEXT NOT NULL DEFAULT '',
  performed_by      TEXT NOT NULL,
  performed_by_role TEXT NOT NULL CHECK (performed_by_role IN ('admin','employee')),
  details           TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_employees ON employees;
CREATE TRIGGER set_updated_at_employees  BEFORE UPDATE ON employees      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_hospitals ON hospitals;
CREATE TRIGGER set_updated_at_hospitals  BEFORE UPDATE ON hospitals      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_cases ON cases;
CREATE TRIGGER set_updated_at_cases      BEFORE UPDATE ON cases          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_kits ON surgical_kits;
CREATE TRIGGER set_updated_at_kits       BEFORE UPDATE ON surgical_kits  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- SEED — Departments
-- ============================================================
INSERT INTO departments (id, name, description, color) VALUES
  ('11111111-0001-0001-0001-000000000001', 'Stores',               'Implant kit storage, inventory and verification.',  'bg-violet-100 text-violet-800'),
  ('11111111-0001-0001-0001-000000000002', 'Scrub Person',         'Assisting surgeons during the implant operation.',  'bg-blue-100 text-blue-800'),
  ('11111111-0001-0001-0001-000000000003', 'Cleaning Department',  'Sterilization and cleaning of surgical kits.',      'bg-cyan-100 text-cyan-800'),
  ('11111111-0001-0001-0001-000000000004', 'Stores Audit',         'Audit of items, materials, and kit completeness.', 'bg-amber-100 text-amber-800'),
  ('11111111-0001-0001-0001-000000000005', 'Accounts',             'Billing and invoicing for surgical procedures.',    'bg-emerald-100 text-emerald-800'),
  ('11111111-0001-0001-0001-000000000006', 'Collection Executive', 'Collection of invoice amounts from hospitals.',     'bg-orange-100 text-orange-800')
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- SEED — Surgical Kits
-- ============================================================
INSERT INTO surgical_kits (name, type, serial_number, status) VALUES
  ('Total Knee Replacement System',         'Knee Implant',       'SN-2025-001', 'Available'),
  ('Hip Replacement System - Cementless',   'Hip Implant',        'SN-2025-002', 'Available'),
  ('Lumbar Fusion System - TLIF',           'Spine Implant',      'SN-2025-003', 'Available'),
  ('Proximal Femoral Nail - Long',          'Trauma Implant',     'SN-2025-004', 'Available'),
  ('Unicompartmental Knee System',          'Knee Implant',       'SN-2025-005', 'Available'),
  ('Tumor Mega Prosthesis - Distal Femur',  'Oncology Implant',   'SN-2025-006', 'Available'),
  ('Arthroscopic ACL Reconstruction Kit',  'Sports Medicine',    'SN-2025-007', 'Available'),
  ('Paediatric Tibial Nail System',         'Paediatric Implant', 'SN-2025-008', 'Available'),
  ('Cervical Disc Replacement System',      'Spine Implant',      'SN-2025-009', 'Available'),
  ('Dynamic Hip Screw System',              'Trauma Implant',     'SN-2025-010', 'Available'),
  ('Total Shoulder Replacement',            'Shoulder Implant',   'SN-2025-011', 'Available'),
  ('Locking Compression Plate - Radius',   'Trauma Implant',     'SN-2025-012', 'Available')
ON CONFLICT (serial_number) DO NOTHING;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE employees     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgical_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log  ENABLE ROW LEVEL SECURITY;

-- Helper: get role of the currently logged-in user
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get employee ID of the currently logged-in user
CREATE OR REPLACE FUNCTION current_employee_id()
RETURNS UUID AS $$
  SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- EMPLOYEES
DROP POLICY IF EXISTS "employees_admin_all"   ON employees;
DROP POLICY IF EXISTS "employees_self_select" ON employees;
DROP POLICY IF EXISTS "employees_self_update" ON employees;
CREATE POLICY "employees_admin_all"   ON employees FOR ALL    USING (current_user_role() = 'admin');
CREATE POLICY "employees_self_select" ON employees FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "employees_self_update" ON employees FOR UPDATE USING (auth_user_id = auth.uid());
CREATE POLICY "employees_self_insert" ON employees FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email')
);

-- HOSPITALS
DROP POLICY IF EXISTS "hospitals_read_all"    ON hospitals;
DROP POLICY IF EXISTS "hospitals_admin_write" ON hospitals;
CREATE POLICY "hospitals_read_all"    ON hospitals FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "hospitals_admin_write" ON hospitals FOR ALL    USING (current_user_role() = 'admin');

-- DOCTORS
DROP POLICY IF EXISTS "doctors_read_all"    ON doctors;
DROP POLICY IF EXISTS "doctors_admin_write" ON doctors;
CREATE POLICY "doctors_read_all"    ON doctors FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "doctors_admin_write" ON doctors FOR ALL    USING (current_user_role() = 'admin');

-- DEPARTMENTS
DROP POLICY IF EXISTS "departments_read_all" ON departments;
CREATE POLICY "departments_read_all" ON departments FOR SELECT USING (auth.uid() IS NOT NULL);

-- SURGICAL KITS
DROP POLICY IF EXISTS "kits_read_all"    ON surgical_kits;
DROP POLICY IF EXISTS "kits_admin_write" ON surgical_kits;
CREATE POLICY "kits_read_all"    ON surgical_kits FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "kits_admin_write" ON surgical_kits FOR ALL    USING (current_user_role() = 'admin');

-- CASES
DROP POLICY IF EXISTS "cases_admin_all"         ON cases;
DROP POLICY IF EXISTS "cases_employee_assigned" ON cases;
DROP POLICY IF EXISTS "cases_employee_update"   ON cases;
CREATE POLICY "cases_admin_all"         ON cases FOR ALL    USING (current_user_role() = 'admin');
CREATE POLICY "cases_employee_assigned" ON cases FOR SELECT USING (assigned_employee_id = current_employee_id());
CREATE POLICY "cases_employee_update"   ON cases FOR UPDATE USING (assigned_employee_id = current_employee_id());

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_own" ON notifications;
DROP POLICY IF EXISTS "notifications_admin_all" ON notifications;
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (recipient_id = current_employee_id());
CREATE POLICY "notifications_admin_all" ON notifications FOR ALL USING (current_user_role() = 'admin');

-- APPROVALS
DROP POLICY IF EXISTS "approvals_admin_all"     ON approvals;
DROP POLICY IF EXISTS "approvals_employee_read" ON approvals;
CREATE POLICY "approvals_admin_all"     ON approvals FOR ALL    USING (current_user_role() = 'admin');
CREATE POLICY "approvals_employee_read" ON approvals FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = approvals.case_id
      AND cases.assigned_employee_id = current_employee_id()
  )
);
DROP POLICY IF EXISTS "approvals_employee_insert" ON approvals;
CREATE POLICY "approvals_employee_insert" ON approvals FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = approvals.case_id
      AND cases.assigned_employee_id = current_employee_id()
  )
);

-- ACTIVITY LOG
DROP POLICY IF EXISTS "activity_admin_all"       ON activity_log;
DROP POLICY IF EXISTS "activity_employee_read"   ON activity_log;
DROP POLICY IF EXISTS "activity_employee_insert" ON activity_log;
CREATE POLICY "activity_admin_all"       ON activity_log FOR ALL    USING (current_user_role() = 'admin');
CREATE POLICY "activity_employee_read"   ON activity_log FOR SELECT USING (current_user_role() = 'employee');
CREATE POLICY "activity_employee_insert" ON activity_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

