-- Pre-course questionnaire: one row per (student, course).
-- The row is both the request (token, when it was sent) and, once the
-- student submits, the answers. Unlike course feedback this is not
-- anonymous: the teacher plans lessons around each student's answers.
-- Answers are JSON keyed by question id (see functions/api/_questionnaire.js),
-- so rewording or adding a question needs no migration.
--
-- Only the service key touches this table (Pages Functions), and the service
-- key bypasses RLS, so RLS is enabled with no policies: nobody else gets in.
--
-- Run in the Supabase SQL editor or via: supabase db push

CREATE TABLE IF NOT EXISTS course_questionnaires (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  token         TEXT UNIQUE NOT NULL,
  language      TEXT NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'en')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at  TIMESTAMPTZ,
  answers       JSONB,
  UNIQUE (student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_questionnaires_course ON course_questionnaires(course_id);
CREATE INDEX IF NOT EXISTS idx_course_questionnaires_student ON course_questionnaires(student_id);

ALTER TABLE course_questionnaires ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
