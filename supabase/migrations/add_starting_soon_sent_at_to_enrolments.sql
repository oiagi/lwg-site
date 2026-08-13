-- Track per-student "your course starts soon" sends so the course detail
-- communications summary can show "sent to n of total" accurately.

ALTER TABLE enrolments
  ADD COLUMN IF NOT EXISTS starting_soon_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS enrolments_starting_soon_sent_at_idx
  ON enrolments(starting_soon_sent_at)
  WHERE starting_soon_sent_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
