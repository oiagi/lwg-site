-- Track when a company booking code was last emailed to a student so the
-- admin company and student detail views can show a sent tag.
--
-- Run in the Supabase SQL editor or via: supabase db push

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS booking_code_sent_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
