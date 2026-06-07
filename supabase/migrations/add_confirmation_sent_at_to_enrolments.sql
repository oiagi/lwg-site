-- Track per-student course confirmation sends so the course detail
-- communications summary can show "sent to n of total" accurately.

ALTER TABLE enrolments
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS enrolments_confirmation_sent_at_idx
  ON enrolments(confirmation_sent_at)
  WHERE confirmation_sent_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
