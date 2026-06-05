-- Add booking_code to companies table.
-- Used to send a deep-link email to company students so they can access
-- group courses associated with their employer.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS booking_code TEXT;
