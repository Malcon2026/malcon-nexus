-- Stage photo uploads for employee submissions
-- Run in Supabase SQL Editor if not applied via CLI

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stage-photos',
  'stage-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Authenticated users can upload stage photos
DROP POLICY IF EXISTS "stage_photos_insert" ON storage.objects;
CREATE POLICY "stage_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stage-photos');

-- Anyone can view (public bucket — URLs used in admin approval UI)
DROP POLICY IF EXISTS "stage_photos_select" ON storage.objects;
CREATE POLICY "stage_photos_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'stage-photos');

-- Users can update/delete their own uploads (path prefix not enforced — keep simple)
DROP POLICY IF EXISTS "stage_photos_update" ON storage.objects;
CREATE POLICY "stage_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'stage-photos');

DROP POLICY IF EXISTS "stage_photos_delete" ON storage.objects;
CREATE POLICY "stage_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'stage-photos');
