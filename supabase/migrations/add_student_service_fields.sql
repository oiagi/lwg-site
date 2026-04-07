-- Add service type and tutoring-specific fields to students table.
-- Required by: functions/api/save-student.js (service, grade, subjects allowlist)
-- Run in the Supabase SQL editor or via: supabase db push

ALTER TABLE students ADD COLUMN IF NOT EXISTS service  TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS grade    TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS subjects TEXT;
