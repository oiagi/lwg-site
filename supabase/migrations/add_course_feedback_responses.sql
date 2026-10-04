-- Anonymous course feedback: two forms (mid-course and end of course) and
-- answers that are stored apart from the student.
--
-- course_feedback           one row per (student, course, kind): the request.
--                           It knows who was asked and whether the token has
--                           been used, nothing else.
-- course_feedback_responses one row per submitted form: course, kind, the day
--                           and the answers as JSON. No student reference, no
--                           exact timestamp, so a response cannot be matched
--                           back to a request.
--
-- Anonymity has a natural limit the app cannot lift: a course with one
-- participant has one respondent, and once every requested student has
-- answered, each of them evidently did.
--
-- Answers are keyed by question id as defined in functions/api/_feedback.js;
-- rewording or adding a question needs no migration.
--
-- Required by: functions/api/send-feedback-request.js, functions/api/feedback.js,
--              functions/api/get-feedback.js, functions/api/get-courses.js
-- Run after add_course_feedback.sql, in the Supabase SQL editor or via:
--   supabase db push

-- ── 1. Requests: one per form kind ───────────────────────────────────────
ALTER TABLE course_feedback
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'final';

ALTER TABLE course_feedback DROP CONSTRAINT IF EXISTS course_feedback_kind_check;
ALTER TABLE course_feedback
  ADD CONSTRAINT course_feedback_kind_check CHECK (kind IN ('midterm', 'final'));

-- A student can be asked once per kind per course.
ALTER TABLE course_feedback DROP CONSTRAINT IF EXISTS course_feedback_student_id_course_id_key;
ALTER TABLE course_feedback DROP CONSTRAINT IF EXISTS course_feedback_student_id_course_id_kind_key;
ALTER TABLE course_feedback
  ADD CONSTRAINT course_feedback_student_id_course_id_kind_key UNIQUE (student_id, course_id, kind);

-- ── 2. Responses: anonymous ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_feedback_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('midterm', 'final')),
  -- Day only: an exact time could be lined up with a request's submitted_at.
  submitted_on DATE NOT NULL DEFAULT current_date,
  answers      JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_course_feedback_responses_course
  ON course_feedback_responses(course_id);

-- Row level security is switched on by the rls_auto_enable() trigger like on
-- every other table; the API uses the service key, so no policy is needed.

-- ── 3. Backfill answers already given, as anonymous end-of-course responses ─
-- Keys follow the question ids of the previous form. Ids that no longer
-- exist (confidence, independence, difficult, one_change) are kept in the
-- JSON but not shown by the admin. Safe to re-run: the NOT EXISTS guard
-- skips courses that already have a backfilled response per submitted row.
--
-- The old form rated 1-5; the new one rates 1-10, so the old ratings are
-- stretched onto the new scale (1→1, 2→3, 3→6, 4→8, 5→10) and the old
-- 0-10 recommendation has its 0 lifted to the new minimum of 1.
CREATE OR REPLACE FUNCTION pg_temp.rescale_1_5(v SMALLINT) RETURNS SMALLINT
  LANGUAGE sql IMMUTABLE AS $$ SELECT (round((v - 1) * 9 / 4.0) + 1)::smallint $$;

INSERT INTO course_feedback_responses (course_id, kind, submitted_on, answers)
SELECT
  f.course_id,
  'final',
  f.submitted_at::date,
  jsonb_strip_nulls(jsonb_build_object(
    'satisfaction',     pg_temp.rescale_1_5(f.rating_satisfaction),
    'organisation',     pg_temp.rescale_1_5(f.rating_organisation),
    'teaching',         pg_temp.rescale_1_5(f.rating_teaching),
    'comfort',          pg_temp.rescale_1_5(f.rating_comfort),
    'pace',             pg_temp.rescale_1_5(f.rating_pace),
    'materials',        pg_temp.rescale_1_5(f.rating_materials),
    'speaking',         pg_temp.rescale_1_5(f.rating_speaking),
    'vocabulary',       pg_temp.rescale_1_5(f.rating_vocabulary),
    'independence',     pg_temp.rescale_1_5(f.rating_independence),
    'confidence',       pg_temp.rescale_1_5(f.rating_confidence),
    'exam_ready',       pg_temp.rescale_1_5(f.rating_exam_ready),
    'positive',         f.comment_positive,
    'improve',          f.comment_improve,
    'difficult',        f.comment_difficult,
    'progress',         f.progress_level,
    'progress_note',    f.comment_progress,
    'activities',       to_jsonb(f.activities_helpful),
    'activities_other', f.activities_other,
    'recommend',        GREATEST(f.nps_recommend, 1),
    'one_change',       f.comment_one_change,
    'continue',         f.continue_interest,
    'next_topic',       f.comment_next,
    'anything_else',    f.comment_other
  ))
FROM course_feedback f
WHERE f.submitted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM course_feedback_responses r
    WHERE r.course_id = f.course_id AND r.kind = 'final'
  );

-- ── 4. Old answer columns ────────────────────────────────────────────────
-- No longer read or written. Drop them once the backfill above has been
-- checked (compare the row counts), so the request table really holds
-- nothing but who was asked:
--   ALTER TABLE course_feedback DROP CONSTRAINT IF EXISTS course_feedback_answer_checks;
--   ALTER TABLE course_feedback
--     DROP COLUMN IF EXISTS rating_satisfaction, DROP COLUMN IF EXISTS rating_organisation,
--     DROP COLUMN IF EXISTS rating_teaching,     DROP COLUMN IF EXISTS rating_comfort,
--     DROP COLUMN IF EXISTS rating_pace,         DROP COLUMN IF EXISTS rating_materials,
--     DROP COLUMN IF EXISTS rating_speaking,     DROP COLUMN IF EXISTS rating_vocabulary,
--     DROP COLUMN IF EXISTS rating_independence, DROP COLUMN IF EXISTS rating_confidence,
--     DROP COLUMN IF EXISTS rating_exam_ready,   DROP COLUMN IF EXISTS comment_positive,
--     DROP COLUMN IF EXISTS comment_improve,     DROP COLUMN IF EXISTS comment_difficult,
--     DROP COLUMN IF EXISTS progress_level,      DROP COLUMN IF EXISTS comment_progress,
--     DROP COLUMN IF EXISTS activities_helpful,  DROP COLUMN IF EXISTS activities_other,
--     DROP COLUMN IF EXISTS nps_recommend,       DROP COLUMN IF EXISTS comment_one_change,
--     DROP COLUMN IF EXISTS continue_interest,   DROP COLUMN IF EXISTS comment_next,
--     DROP COLUMN IF EXISTS comment_other,       DROP COLUMN IF EXISTS rating_recommend,
--     DROP COLUMN IF EXISTS course_type,         DROP COLUMN IF EXISTS course_type_other,
--     DROP COLUMN IF EXISTS attendance_count,    DROP COLUMN IF EXISTS consent_publish;

NOTIFY pgrst, 'reload schema';
