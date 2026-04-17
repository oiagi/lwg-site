-- Phase 2: data-model redesign
--
-- Adds:
--   - students.customer_reference  (5-digit zero-padded, auto-generated, stable)
--   - students.subject             (unified replacement for service + target_language)
--   - courses.subject              (what the course teaches)
--   - courses.price_per_60min      (course-level hourly rate; depends on group size)
--   - courses.session_length_min   (default 60)
--   - enrolments.price_per_60min_override  (optional discount per student)
--   - invoices.course_id           (link invoice to course for outstanding-balance aggregation)
--
-- Run in the Supabase SQL editor or via: supabase db push

-- ── Customer reference: sequential, zero-padded to 5 digits ─────────────
CREATE SEQUENCE IF NOT EXISTS student_customer_ref_seq
  START WITH 10001  -- 5-digit starting point; leaves 10000 available if we ever need a sentinel
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS customer_reference TEXT
  DEFAULT LPAD(NEXTVAL('student_customer_ref_seq')::TEXT, 5, '0');

-- Backfill rows missing a reference (ordered by created_at for stable numbering)
UPDATE students
SET customer_reference = LPAD(NEXTVAL('student_customer_ref_seq')::TEXT, 5, '0')
WHERE customer_reference IS NULL;

-- Enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS students_customer_reference_key
  ON students (customer_reference);

-- ── Unified subject field ───────────────────────────────────────────────
ALTER TABLE students ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE courses  ADD COLUMN IF NOT EXISTS subject TEXT;

-- Backfill students.subject from existing target_language/service
UPDATE students
SET subject = COALESCE(
  NULLIF(target_language, ''),
  CASE
    WHEN service = 'tutoring'          THEN 'Tutoring'
    WHEN service = 'gymivorbereitung'  THEN 'Tutoring'
    WHEN service = 'exam preparation'  THEN 'Exam prep'
    WHEN service = 'language course'   THEN 'Language'
    ELSE NULL
  END
)
WHERE subject IS NULL;

-- Backfill courses.subject from existing service
UPDATE courses
SET subject = service
WHERE subject IS NULL AND service IS NOT NULL;

-- ── Course pricing ──────────────────────────────────────────────────────
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS price_per_60min     NUMERIC(10, 2);
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS session_length_min  INTEGER DEFAULT 60;

-- ── Enrolment-level price override (for individual discounts) ───────────
ALTER TABLE enrolments
  ADD COLUMN IF NOT EXISTS price_per_60min_override NUMERIC(10, 2);

-- ── Invoices linked to courses ──────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoices_course_id_idx ON invoices (course_id);
