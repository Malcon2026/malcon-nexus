-- Trip kilometres: previous meter + current meter = kms driven (e.g. 1234 → 1254 = 20)
-- Also allow more than one open petrol request per employee per day
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE petrol_requests
  ADD COLUMN IF NOT EXISTS kms_start NUMERIC(10, 1),
  ADD COLUMN IF NOT EXISTS kms_end NUMERIC(10, 1);

DROP INDEX IF EXISTS idx_petrol_one_open_per_employee;
DROP INDEX IF EXISTS idx_petrol_one_pending_per_employee;

-- Dummy / mistaken odometer dumps were stored in kms (15,000+).
-- Convert those to trip km so dashboard totals are distance driven.
UPDATE petrol_requests
SET
  kms_end = kms,
  kms_start = GREATEST(kms - 30, 0),
  kms = 30
WHERE kms IS NOT NULL AND kms > 500 AND kms_start IS NULL AND kms_end IS NULL;

COMMIT;
