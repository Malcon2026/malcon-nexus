-- Generic admin-only key/value settings table, so small config values (like
-- the per-km incentive rate) are shared across every admin/device instead of
-- living in one browser's localStorage.
-- Run in Supabase Dashboard -> SQL Editor (or via `supabase db query --linked`).

BEGIN;

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_by  TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_admin_all" ON app_settings;

CREATE POLICY "app_settings_admin_all" ON app_settings
  FOR ALL USING (current_user_role() = 'admin');

-- Seed the default incentive rate (₹3/km) if not already set.
INSERT INTO app_settings (key, value, updated_by)
VALUES ('incentive_rate_per_km', '3', 'migration')
ON CONFLICT (key) DO NOTHING;

COMMIT;
