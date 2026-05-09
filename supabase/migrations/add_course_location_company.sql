-- Add an optional company/venue name before the street in course location addresses.
-- Useful for company classes or classroom venues where the company name should
-- appear in confirmations and certificates.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS location_company TEXT;
