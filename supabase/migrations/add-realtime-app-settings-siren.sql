-- Realtime ping for admin "test siren for all employees" (app open only).
ALTER TABLE app_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
  END IF;
END $$;

INSERT INTO app_settings (key, value, updated_by)
VALUES ('siren_test_at', '0', 'migration')
ON CONFLICT (key) DO NOTHING;
