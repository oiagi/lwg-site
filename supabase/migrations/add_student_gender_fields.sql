-- Add student gender fields used for formal German address in communication.
-- Required by: public group booking/intake forms, invoices, automated emails.
-- Run in the Supabase SQL editor or via: supabase db push

ALTER TABLE students ADD COLUMN IF NOT EXISTS gender      TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender_note TEXT;

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_gender_check;

ALTER TABLE students
  ADD CONSTRAINT students_gender_check
  CHECK (gender IS NULL OR gender IN ('female', 'male', 'other'));
