-- Undo in-app siren Realtime setup (run in Supabase SQL Editor if migrations were applied).

DELETE FROM app_settings WHERE key = 'siren_test_at';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE app_settings;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cases'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE cases;
  END IF;
END $$;

ALTER TABLE app_settings REPLICA IDENTITY DEFAULT;
ALTER TABLE cases REPLICA IDENTITY DEFAULT;
