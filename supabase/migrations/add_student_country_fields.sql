-- Add country / billing_country (ISO 3166-1 alpha-2, e.g. 'CH') to students.
-- Required by: functions/api/intake.js, company-intake.js, book-course.js,
--   save-student.js, import-students.js, get-student-detail.js, get-courses.js,
--   invoice-archive.js (Swiss QR-bill debtor country, invoice address block).
-- Run in the Supabase SQL editor or via: supabase db push

alter table students
  add column if not exists country text,
  add column if not exists billing_country text;

alter table students
  drop constraint if exists students_country_check;

alter table students
  add constraint students_country_check
  check (country is null or country ~ '^[A-Z]{2}$');

alter table students
  drop constraint if exists students_billing_country_check;

alter table students
  add constraint students_billing_country_check
  check (billing_country is null or billing_country ~ '^[A-Z]{2}$');

-- Existing students are assumed to be in Switzerland.
update students
set country = 'CH'
where country is null;

update students
set billing_country = 'CH'
where billing_country is null
  and (
    billing_name is not null
    or billing_address is not null
    or billing_street is not null
    or billing_postcode is not null
    or billing_city is not null
  );
