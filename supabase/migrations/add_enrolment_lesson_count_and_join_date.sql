-- Store per-course, per-student billing and attendance overrides.
-- invoice_lesson_count is nullable: null means use the course duration.
-- joined_at is nullable: null means the student belongs to all course sessions.

ALTER TABLE enrolments
  ADD COLUMN IF NOT EXISTS invoice_lesson_count INTEGER
    CHECK (invoice_lesson_count IS NULL OR invoice_lesson_count > 0);

ALTER TABLE enrolments
  ADD COLUMN IF NOT EXISTS joined_at DATE;

CREATE INDEX IF NOT EXISTS enrolments_course_joined_at_idx
  ON enrolments(course_id, joined_at);
