-- Global blocked dates for session scheduling.
--
-- Each row is an inclusive date range (single day = same start/end) during
-- which no course sessions may be scheduled. Weekly recurring courses skip
-- occurrences that fall inside a blocked period and append the skipped
-- sessions after the last scheduled one (via RRULE EXDATE + extended COUNT
-- on the Google Calendar event).
--
-- Run in the Supabase SQL editor or via: supabase db push

CREATE TABLE IF NOT EXISTS blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  label TEXT,
  CONSTRAINT blocked_dates_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_blocked_dates_range ON blocked_dates (start_date, end_date);

NOTIFY pgrst, 'reload schema';
