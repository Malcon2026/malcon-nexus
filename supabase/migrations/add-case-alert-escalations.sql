-- Three-step case alert escalation (Alert 1 → +15m Alert 2 → +15m Alert 3, then stop).

CREATE TABLE IF NOT EXISTS case_alert_escalations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK (event_type IN ('assignment', 'postpone')),
  alert_1_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alert_2_sent_at TIMESTAMPTZ,
  alert_3_sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, employee_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_case_alert_escalations_pending
  ON case_alert_escalations (alert_1_sent_at)
  WHERE acknowledged_at IS NULL AND alert_3_sent_at IS NULL;

ALTER TABLE case_alert_escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_alert_escalations_admin_all" ON case_alert_escalations;
CREATE POLICY "case_alert_escalations_admin_all" ON case_alert_escalations
  FOR ALL USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS "case_alert_escalations_employee_read" ON case_alert_escalations;
CREATE POLICY "case_alert_escalations_employee_read" ON case_alert_escalations
  FOR SELECT USING (employee_id = current_employee_id());

COMMENT ON TABLE case_alert_escalations IS 'Tracks 3-step Telegram/push alert ladder per case assignment or postpone.';
