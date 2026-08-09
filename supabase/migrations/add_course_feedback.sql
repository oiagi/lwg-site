-- Course feedback requests and responses.
-- One row per (student, course): created when the request email is sent,
-- filled in when the student submits the form at /feedback.html?token=...
-- Required by: functions/api/send-feedback-request.js, functions/api/feedback.js
-- The columns mirror FEEDBACK_FIELDS in functions/api/_feedback.js — add a
-- question there and a column here in the same change.
-- Not every question is asked of every student: the course profile decides
-- which ones apply, so a column left NULL can mean "not asked" as well as
-- "skipped". See courseFeedbackProfile() in _feedback.js.
-- Run in the Supabase SQL editor or via: supabase db push

CREATE TABLE IF NOT EXISTS course_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id           UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  token               TEXT UNIQUE NOT NULL,
  language            TEXT NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'en')),
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at        TIMESTAMPTZ,

  -- 1. overall satisfaction, 2. the statements (all 1-5)
  rating_satisfaction SMALLINT CHECK (rating_satisfaction BETWEEN 1 AND 5),
  rating_organisation SMALLINT CHECK (rating_organisation BETWEEN 1 AND 5),
  rating_teaching     SMALLINT CHECK (rating_teaching     BETWEEN 1 AND 5),
  rating_comfort      SMALLINT CHECK (rating_comfort      BETWEEN 1 AND 5),
  rating_pace         SMALLINT CHECK (rating_pace         BETWEEN 1 AND 5),
  rating_materials    SMALLINT CHECK (rating_materials    BETWEEN 1 AND 5),
  -- language courses only
  rating_speaking     SMALLINT CHECK (rating_speaking     BETWEEN 1 AND 5),
  rating_vocabulary   SMALLINT CHECK (rating_vocabulary   BETWEEN 1 AND 5),
  -- tutoring and exam preparation only
  rating_independence SMALLINT CHECK (rating_independence BETWEEN 1 AND 5),
  rating_confidence   SMALLINT CHECK (rating_confidence   BETWEEN 1 AND 5),
  -- exam preparation and Gymivorbereitung only
  rating_exam_ready   SMALLINT CHECK (rating_exam_ready   BETWEEN 1 AND 5),

  -- 3-5. free text
  comment_positive    TEXT,
  comment_improve     TEXT,
  comment_difficult   TEXT,

  -- 6. progress, 7. which activities helped
  progress_level      TEXT CHECK (progress_level IN ('a_lot','good','some','little','none')),
  comment_progress    TEXT,
  activities_helpful  TEXT[],
  activities_other    TEXT,

  -- 8. recommendation (0-10 NPS), 9-11. the closing questions
  nps_recommend       SMALLINT CHECK (nps_recommend BETWEEN 0 AND 10),
  comment_one_change  TEXT,
  continue_interest   TEXT CHECK (continue_interest IN ('yes','maybe','no')),
  comment_next        TEXT,
  comment_other       TEXT,

  UNIQUE (student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_feedback_course ON course_feedback(course_id);
CREATE INDEX IF NOT EXISTS idx_course_feedback_student ON course_feedback(student_id);

-- ── Upgrade path ────────────────────────────────────────────────────────
-- For a database that already has an earlier version of this table. Safe to
-- run on a fresh one too: every statement is a no-op there.
ALTER TABLE course_feedback
  ADD COLUMN IF NOT EXISTS rating_satisfaction SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_organisation SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_comfort      SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_speaking     SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_vocabulary   SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_independence SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_confidence   SMALLINT,
  ADD COLUMN IF NOT EXISTS rating_exam_ready   SMALLINT,
  ADD COLUMN IF NOT EXISTS comment_difficult   TEXT,
  ADD COLUMN IF NOT EXISTS progress_level      TEXT,
  ADD COLUMN IF NOT EXISTS comment_progress    TEXT,
  ADD COLUMN IF NOT EXISTS activities_helpful  TEXT[],
  ADD COLUMN IF NOT EXISTS activities_other    TEXT,
  ADD COLUMN IF NOT EXISTS nps_recommend       SMALLINT,
  ADD COLUMN IF NOT EXISTS comment_one_change  TEXT,
  ADD COLUMN IF NOT EXISTS continue_interest   TEXT,
  ADD COLUMN IF NOT EXISTS comment_next        TEXT,
  ADD COLUMN IF NOT EXISTS comment_other       TEXT;

-- Dropped so a table upgraded by an earlier run of this file gets the current
-- set of checks below rather than keeping a stale one.
ALTER TABLE course_feedback DROP CONSTRAINT IF EXISTS course_feedback_answer_checks;

DO $$
BEGIN
  -- ADD COLUMN cannot carry the CHECKs the CREATE TABLE above gives these
  -- columns, so an upgraded table needs them added afterwards. Presence of
  -- a check on rating_satisfaction tells the two cases apart: a fresh table
  -- already has one, an upgraded one does not. That also makes this block
  -- self-idempotent, since the constraint it adds covers that column.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'course_feedback'::regclass
      AND c.contype = 'c'
      AND a.attname = 'rating_satisfaction'
  ) THEN
    ALTER TABLE course_feedback
      ADD CONSTRAINT course_feedback_answer_checks CHECK (
        (rating_satisfaction IS NULL OR rating_satisfaction BETWEEN 1 AND 5)
        AND (rating_organisation IS NULL OR rating_organisation BETWEEN 1 AND 5)
        AND (rating_comfort      IS NULL OR rating_comfort      BETWEEN 1 AND 5)
        AND (rating_speaking     IS NULL OR rating_speaking     BETWEEN 1 AND 5)
        AND (rating_vocabulary   IS NULL OR rating_vocabulary   BETWEEN 1 AND 5)
        AND (rating_independence IS NULL OR rating_independence BETWEEN 1 AND 5)
        AND (rating_confidence   IS NULL OR rating_confidence   BETWEEN 1 AND 5)
        AND (rating_exam_ready   IS NULL OR rating_exam_ready   BETWEEN 1 AND 5)
        AND (progress_level IS NULL OR progress_level IN ('a_lot','good','some','little','none'))
        AND (nps_recommend IS NULL OR nps_recommend BETWEEN 0 AND 10)
        AND (continue_interest IS NULL OR continue_interest IN ('yes','maybe','no'))
      );
  END IF;
END $$;

-- Columns from earlier drafts of this form. Only drop them once you are sure
-- no answers are stored in them:
--   -- the 1-5 "how likely to recommend" question became the 0-10 NPS
--   ALTER TABLE course_feedback DROP COLUMN IF EXISTS rating_recommend;
--   -- "which course did you take?" is no longer asked; the form header says
--   ALTER TABLE course_feedback DROP COLUMN IF EXISTS course_type;
--   ALTER TABLE course_feedback DROP COLUMN IF EXISTS course_type_other;
--   -- lesson count is no longer asked; enrolments and attendance know it
--   ALTER TABLE course_feedback DROP COLUMN IF EXISTS attendance_count;
--   -- permission to publish is no longer asked
--   ALTER TABLE course_feedback DROP COLUMN IF EXISTS consent_publish;

NOTIFY pgrst, 'reload schema';
