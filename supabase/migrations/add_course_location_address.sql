-- Add a structured course location address (street, street number, postal
-- code, city) so the certificate of attendance can show the actual venue
-- instead of just the location type ("online", "company", "student's home", …).
-- The existing courses.location column is kept and continues to hold the
-- location type; the new columns are all optional.
--
-- Consumed by: admin/courses.js (course overview, inline "+ add address"),
--              admin/course-new.js, admin/course-edit.js,
--              admin/certificates.js (certificate preview + PDF),
--              functions/api/confirm-booking.js, functions/api/update-course.js,
--              functions/api/send-course-confirmation.js.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS location_street        TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS location_street_number TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS location_postal_code   TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS location_city          TEXT;
