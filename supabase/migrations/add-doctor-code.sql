-- Human-readable doctor IDs (MLS-DOC-001, …) for master list / dedup.
-- Run in Supabase Dashboard → SQL Editor (or supabase db push).

BEGIN;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS doctor_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_doctor_code
  ON public.doctors (doctor_code)
  WHERE doctor_code IS NOT NULL AND doctor_code <> '';

COMMIT;
