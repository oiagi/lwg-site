-- Add an explicit admin-controlled flag for courses that may be displayed on
-- the public direct-booking page. Eligibility checks still need to verify
-- location, group type, date, status, and capacity before exposing a course.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS public_booking_enabled BOOLEAN DEFAULT false;
