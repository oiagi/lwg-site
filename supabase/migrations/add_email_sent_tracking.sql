-- Track when course-level communications were sent so the admin
-- course overview can surface "confirmation sent" / "schedule sent"
-- indicators next to existing certificate-sent data.
--
-- - courses.course_confirmation_sent_at: timestamp of the most recent
--   successful send-course-confirmation batch.
-- - enrolments.schedule_sent_at: per-student timestamp set whenever a
--   schedule update is sent to that student (the action is per-enrolment).
--
-- Run in the Supabase SQL editor or via: supabase db push

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS course_confirmation_sent_at TIMESTAMPTZ;

ALTER TABLE enrolments
  ADD COLUMN IF NOT EXISTS schedule_sent_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
