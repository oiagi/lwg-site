-- Strict lesson logging: richer attendance records.
--
-- A session is only ever marked completed when its attendance has been
-- saved (the calendar sync no longer does that by date). Each attendance
-- row now also records how the student attended:
--
--   mode     in_person | online   whether they joined remotely
--   portion  full | half          whether they attended only half the lesson
--
-- The two are independent: online + half is a valid combination. Both are
-- forced back to their defaults for an absent student.
--
-- save-attendance.js upserts with on_conflict=session_id,student_id, which
-- needs a unique index on that pair. The base table was created by hand
-- outside this repo, so the index is created here to make the requirement
-- explicit. If it fails because duplicate rows already exist, keep the newest
-- per pair and re-run:
--
--   DELETE FROM attendance a
--   USING attendance b
--   WHERE a.session_id = b.session_id
--     AND a.student_id = b.student_id
--     AND a.created_at < b.created_at;
--
-- Required by: functions/api/save-attendance.js, functions/api/get-courses.js,
--              functions/api/get-attendance.js
-- Run in the Supabase SQL editor or via:
--   supabase db push

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'in_person';
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS portion TEXT NOT NULL DEFAULT 'full';

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_mode_check;
ALTER TABLE attendance
  ADD CONSTRAINT attendance_mode_check CHECK (mode IN ('in_person', 'online'));

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_portion_check;
ALTER TABLE attendance
  ADD CONSTRAINT attendance_portion_check CHECK (portion IN ('full', 'half'));

CREATE UNIQUE INDEX IF NOT EXISTS attendance_session_student_key
  ON attendance (session_id, student_id);

-- Let PostgREST pick up the new columns without a restart.
NOTIFY pgrst, 'reload schema';
