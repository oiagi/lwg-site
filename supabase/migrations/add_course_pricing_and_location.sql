-- Add per-course pricing, session length and location, and link invoices to courses.
-- Consumed by: admin/courses.js (new course form, course overview),
--              admin/students.js (admin section list per enrolled course),
--              functions/api/confirm-booking.js (writes new course fields),
--              functions/api/get-courses.js, get-student-detail.js (reads).

ALTER TABLE courses ADD COLUMN IF NOT EXISTS session_length_minutes INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_per_session      NUMERIC;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS currency               TEXT DEFAULT 'CHF';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS location               TEXT;

-- Backfill session length for existing rows so the admin UI has a value to render.
UPDATE courses SET session_length_minutes = 50 WHERE session_length_minutes IS NULL;

-- Link invoices to a specific course so "open charges" can be listed per course
-- on the student admin section. Nullable because legacy invoices predate courses.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS invoices_course_id_idx ON invoices(course_id);
