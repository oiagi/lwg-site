-- Track issued certificates of attendance.
-- Required by: functions/api/send-certificates.js
-- Run in the Supabase SQL editor or via: supabase db push

CREATE TABLE IF NOT EXISTS certificates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id      TEXT UNIQUE NOT NULL,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id           UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  language            TEXT NOT NULL DEFAULT 'de',
  attendance_included BOOLEAN NOT NULL DEFAULT FALSE,
  attended_sessions   INTEGER,
  total_sessions      INTEGER,
  recipient_email     TEXT,
  recipient_name      TEXT,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course  ON certificates(course_id);
