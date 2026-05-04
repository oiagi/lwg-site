-- Add explicit per-person pricing normalized to 60 minutes.
-- Existing price_per_session is kept for legacy/admin billing context.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_per_person_per_60min NUMERIC;

-- Backfill from the legacy price_per_session where it appears to represent the
-- course/session total for the configured group size.
UPDATE courses
SET price_per_person_per_60min =
  CASE
    WHEN group_type = 'duo' THEN price_per_session / 2
    WHEN group_type = 'group' THEN price_per_session / 5
    ELSE price_per_session
  END
WHERE price_per_person_per_60min IS NULL
  AND price_per_session IS NOT NULL;
