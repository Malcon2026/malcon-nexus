-- Link employees to Telegram for push alerts (bot /start flow).
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

CREATE INDEX IF NOT EXISTS idx_employees_telegram_chat_id
  ON employees (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL AND telegram_chat_id <> '';

COMMENT ON COLUMN employees.telegram_chat_id IS 'Telegram chat id from @Malcon_Nexus_bot /start link';
