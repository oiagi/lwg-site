-- Ensure course venue/company names exist for public/admin course queries.
-- Some environments had the address columns without the optional company column.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS location_company TEXT;

NOTIFY pgrst, 'reload schema';
