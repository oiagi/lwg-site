-- Align the live schema with what the API code expects.
-- Needed because earlier columns were added by hand under different names,
-- so add_course_pricing_and_location.sql's ADD COLUMN IF NOT EXISTS
-- calls were silently skipped for the renamed columns.
--
-- After running: NOTIFY pgrst, 'reload schema';  -- included at the end.

-- students: save-student.js sets token_created_at on create, but the
-- column was never added, causing PGRST204 on POST /rest/v1/students.
ALTER TABLE students ADD COLUMN IF NOT EXISTS token_created_at TIMESTAMPTZ;

-- courses: rename the historical columns to the names the code uses.
-- Wrapped in DO blocks so this migration is idempotent even after a
-- successful run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'session_length_min'
  ) THEN
    ALTER TABLE courses RENAME COLUMN session_length_min TO session_length_minutes;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'price_per_60min'
  ) THEN
    ALTER TABLE courses RENAME COLUMN price_per_60min TO price_per_session;
  END IF;
END $$;

-- courses: add currency (never created under any name).
ALTER TABLE courses ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CHF';
UPDATE courses SET currency = 'CHF' WHERE currency IS NULL;

NOTIFY pgrst, 'reload schema';
