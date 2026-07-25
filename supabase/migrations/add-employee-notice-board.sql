-- Allow authenticated users to READ app_settings (e.g. employee notice board).
-- Only admins can write (existing app_settings_admin_all policy).
-- Run in Supabase Dashboard → SQL Editor

BEGIN;

DROP POLICY IF EXISTS "app_settings_authenticated_select" ON app_settings;

CREATE POLICY "app_settings_authenticated_select" ON app_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

INSERT INTO app_settings (key, value, updated_by)
VALUES ('employee_notice', '', 'migration')
ON CONFLICT (key) DO NOTHING;

COMMIT;
