ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS company_code_booking_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_code TEXT,
  ADD COLUMN IF NOT EXISTS access_label TEXT;

UPDATE courses
SET access_code = NULLIF(upper(regexp_replace(access_code, '\s+', '', 'g')), '')
WHERE access_code IS NOT NULL;

ALTER TABLE courses
  ADD CONSTRAINT courses_access_code_normalized
  CHECK (access_code IS NULL OR access_code = upper(regexp_replace(access_code, '\s+', '', 'g')));

CREATE INDEX IF NOT EXISTS idx_courses_company_code_booking
  ON courses (access_code, status, company_code_booking_enabled)
  WHERE access_code IS NOT NULL;
