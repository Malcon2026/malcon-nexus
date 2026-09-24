-- Stage photos: employees may upload on submit; only super admins may download/view.
-- Keep in sync with src/lib/superAdmin.ts (DEFAULT_SUPER_ADMIN_EMAILS + VITE_SUPER_ADMIN_EMAILS).

BEGIN;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt()->>'email', '')) IN (
    'jeevanakarsh@gmail.com',
    'jeevan.anishetti@malconnexus.com',
    'preetam.tailam@malconnexus.com'
  );
$$;

UPDATE storage.buckets SET public = false WHERE id = 'stage-photos';

DROP POLICY IF EXISTS "stage_photos_select" ON storage.objects;
CREATE POLICY "stage_photos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'stage-photos' AND public.is_super_admin());

-- Upload on submit (any signed-in user with case access)
DROP POLICY IF EXISTS "stage_photos_insert" ON storage.objects;
CREATE POLICY "stage_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stage-photos');

COMMIT;
