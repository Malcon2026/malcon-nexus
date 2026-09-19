-- Telegram OTP login codes (hashed). Access only via service role in Edge Functions.

BEGIN;

CREATE TABLE IF NOT EXISTS login_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_otps_employee_created
  ON login_otps (employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_otps_active
  ON login_otps (employee_id, expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE login_otps ENABLE ROW LEVEL SECURITY;

COMMIT;
