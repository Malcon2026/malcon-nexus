-- Petrol token workflow: boy requests → admin issues book/token → boy submits pump receipt + kms
-- Run in Supabase Dashboard → SQL Editor
-- Empty table — do not import historical Excel rows.

BEGIN;

CREATE TABLE IF NOT EXISTS petrol_requests (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id            UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employee_name          TEXT NOT NULL DEFAULT '',
  vehicle_no             TEXT NOT NULL DEFAULT '',
  amount                 NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  requested_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'issued', 'receipt_submitted', 'rejected', 'cancelled')),
  book_no                TEXT NOT NULL DEFAULT '',
  token_no               TEXT NOT NULL DEFAULT '',
  issued_by              TEXT,
  issued_by_id           UUID REFERENCES employees(id) ON DELETE SET NULL,
  issued_at              TIMESTAMPTZ,
  kms                    NUMERIC(10, 1),
  receipt_url            TEXT NOT NULL DEFAULT '',
  receipt_submitted_at   TIMESTAMPTZ,
  notes                  TEXT NOT NULL DEFAULT '',
  admin_notes            TEXT NOT NULL DEFAULT '',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_petrol_requests_employee_id ON petrol_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_petrol_requests_status ON petrol_requests(status);
CREATE INDEX IF NOT EXISTS idx_petrol_requests_requested_at ON petrol_requests(requested_at DESC);

-- One open request per employee until the pump receipt is submitted
CREATE UNIQUE INDEX IF NOT EXISTS idx_petrol_one_open_per_employee
  ON petrol_requests (employee_id)
  WHERE status IN ('pending', 'issued');

CREATE UNIQUE INDEX IF NOT EXISTS idx_petrol_book_token
  ON petrol_requests (book_no, token_no)
  WHERE book_no <> '' AND token_no <> '';

ALTER TABLE petrol_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_petrol ON petrol_requests;
CREATE TRIGGER set_updated_at_petrol
  BEFORE UPDATE ON petrol_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP POLICY IF EXISTS "petrol_admin_all" ON petrol_requests;
DROP POLICY IF EXISTS "petrol_employee_select" ON petrol_requests;
DROP POLICY IF EXISTS "petrol_employee_insert" ON petrol_requests;
DROP POLICY IF EXISTS "petrol_employee_cancel" ON petrol_requests;
DROP POLICY IF EXISTS "petrol_employee_receipt" ON petrol_requests;

CREATE POLICY "petrol_admin_all" ON petrol_requests
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY "petrol_employee_select" ON petrol_requests
  FOR SELECT USING (employee_id = current_employee_id());

CREATE POLICY "petrol_employee_insert" ON petrol_requests
  FOR INSERT WITH CHECK (
    employee_id = current_employee_id()
    AND status = 'pending'
  );

CREATE POLICY "petrol_employee_cancel" ON petrol_requests
  FOR UPDATE USING (
    employee_id = current_employee_id()
    AND status = 'pending'
  )
  WITH CHECK (
    employee_id = current_employee_id()
    AND status = 'cancelled'
  );

CREATE POLICY "petrol_employee_receipt" ON petrol_requests
  FOR UPDATE USING (
    employee_id = current_employee_id()
    AND status = 'issued'
  )
  WITH CHECK (
    employee_id = current_employee_id()
    AND status = 'receipt_submitted'
  );

ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_entity_type_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_entity_type_check
  CHECK (entity_type IN (
    'case','employee','hospital','department','kit','system','attendance','leave','expense','petrol'
  ));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'petrol-receipts',
  'petrol-receipts',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "petrol_receipts_insert" ON storage.objects;
CREATE POLICY "petrol_receipts_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'petrol-receipts');

DROP POLICY IF EXISTS "petrol_receipts_select" ON storage.objects;
CREATE POLICY "petrol_receipts_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'petrol-receipts');

COMMIT;
