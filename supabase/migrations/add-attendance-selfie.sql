-- Off-site punch-in selfie (stamped photo URL on approval request)
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

ALTER TABLE attendance_approval_requests
  ADD COLUMN IF NOT EXISTS selfie_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-selfies', 'attendance-selfies', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "attendance_selfies_insert" ON storage.objects;
CREATE POLICY "attendance_selfies_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attendance-selfies');

DROP POLICY IF EXISTS "attendance_selfies_select" ON storage.objects;
CREATE POLICY "attendance_selfies_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attendance-selfies');

DROP POLICY IF EXISTS "attendance_selfies_select_public" ON storage.objects;
CREATE POLICY "attendance_selfies_select_public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'attendance-selfies');

COMMIT;
