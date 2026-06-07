-- Add a company-specific intake code for blanket student intake links.
-- This is intentionally separate from booking_code, which controls course access.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS intake_code TEXT;

UPDATE companies
SET intake_code = UPPER(REPLACE(gen_random_uuid()::TEXT, '-', ''))
WHERE intake_code IS NULL OR intake_code = '';

ALTER TABLE companies
  ALTER COLUMN intake_code SET DEFAULT UPPER(REPLACE(gen_random_uuid()::TEXT, '-', ''));

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_intake_code
  ON companies (intake_code)
  WHERE intake_code IS NOT NULL;
