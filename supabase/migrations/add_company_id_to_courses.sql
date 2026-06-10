-- Migration: add company_id FK to courses
-- Run in Supabase SQL editor.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

-- Auto-link existing courses whose access_code matches a company's booking_code
UPDATE courses c
SET company_id = comp.id
FROM companies comp
WHERE comp.booking_code IS NOT NULL
  AND comp.booking_code <> ''
  AND c.access_code = comp.booking_code
  AND c.company_id IS NULL;
