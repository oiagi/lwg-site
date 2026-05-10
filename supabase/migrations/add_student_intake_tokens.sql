-- Split one-time intake links from the long-lived student sessions portal link.
ALTER TABLE students ADD COLUMN IF NOT EXISTS intake_token TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS intake_token_created_at TIMESTAMPTZ;

ALTER TABLE students
  ALTER COLUMN intake_token TYPE TEXT
  USING intake_token::TEXT;

UPDATE students
SET
  intake_token = COALESCE(intake_token, access_token),
  intake_token_created_at = COALESCE(intake_token_created_at, token_created_at, created_at)
WHERE intake_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS students_intake_token_key
  ON students (intake_token)
  WHERE intake_token IS NOT NULL;
