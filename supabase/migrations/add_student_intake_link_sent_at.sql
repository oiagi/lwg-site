-- Track when an intake link was last emailed to a student so the admin
-- student detail view can show a "sent" tag for that action.
--
-- Run in the Supabase SQL editor or via: supabase db push

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS intake_link_sent_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
