-- Undo in-app siren Realtime setup (run in Supabase SQL Editor if migrations were applied).

DELETE FROM app_settings WHERE key = 'siren_test_at';

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS app_settings;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS cases;

ALTER TABLE app_settings REPLICA IDENTITY DEFAULT;
ALTER TABLE cases REPLICA IDENTITY DEFAULT;
