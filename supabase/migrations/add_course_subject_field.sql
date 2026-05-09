-- Rename service → course_type and add explicit subject field on courses.
-- course_type: the nature of the course (language course, exam preparation, tutoring, gymivorbereitung)
-- subject:     the subject matter (German, Swiss German, English, French, Mathematics, Physics, Other)

ALTER TABLE courses RENAME COLUMN service TO course_type;

ALTER TABLE courses ADD COLUMN subject TEXT;

-- Best-effort backfill for existing courses:
-- language course + CH level → Swiss German
-- language course otherwise  → German
-- Leave everything else NULL (must be set manually on edit)
UPDATE courses SET subject = 'Swiss German'
  WHERE course_type = 'language course' AND level LIKE 'CH%';

UPDATE courses SET subject = 'German'
  WHERE course_type = 'language course' AND (level NOT LIKE 'CH%' OR level IS NULL);
