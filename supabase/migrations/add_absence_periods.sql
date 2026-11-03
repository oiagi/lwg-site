-- Planned absences: inclusive date ranges (Europe/Zurich) during which a
-- student will miss lessons of one course. Rows come from the pre-course
-- questionnaire (the student marks dates in a calendar) or from the admin
-- course view (added by hand).
--
-- Nothing is written onto sessions or attendance. A lesson counts as a
-- planned absence when its Zurich date falls inside one of the student's
-- periods for that course, computed at read time (functions/api/_absences.js),
-- so lessons synced from the calendar later are covered automatically and
-- the "logged" flag (any attendance row) stays meaningful.
--
-- Only the service key touches this table (Pages Functions), and the service
-- key bypasses RLS, so RLS is enabled with no policies: nobody else gets in.
--
-- Run in the Supabase SQL editor or via: supabase db push

CREATE TABLE IF NOT EXISTS absence_periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  source      TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('questionnaire', 'admin')),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_absence_periods_course ON absence_periods(course_id);
CREATE INDEX IF NOT EXISTS idx_absence_periods_student ON absence_periods(student_id);

ALTER TABLE absence_periods ENABLE ROW LEVEL SECURITY;

-- Backfill: questionnaires answered before this table existed still hold
-- their date ranges in answers->'absences' (an array of {from, to}). Copy
-- them over once, for every (student, course) that has no questionnaire
-- rows yet. Safe to re-run.
INSERT INTO absence_periods (student_id, course_id, start_date, end_date, source)
SELECT
  q.student_id,
  q.course_id,
  (r->>'from')::date,
  (r->>'to')::date,
  'questionnaire'
FROM course_questionnaires q
CROSS JOIN LATERAL jsonb_array_elements(q.answers->'absences') AS r
WHERE q.submitted_at IS NOT NULL
  AND jsonb_typeof(q.answers->'absences') = 'array'
  AND (r->>'from') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM absence_periods p
    WHERE p.student_id = q.student_id
      AND p.course_id = q.course_id
      AND p.source = 'questionnaire'
  );

NOTIFY pgrst, 'reload schema';
