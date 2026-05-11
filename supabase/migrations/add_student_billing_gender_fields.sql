alter table students
  add column if not exists billing_gender text,
  add column if not exists billing_gender_note text;

alter table students
  drop constraint if exists students_billing_gender_check;

alter table students
  add constraint students_billing_gender_check
  check (billing_gender is null or billing_gender in ('female', 'male', 'other'));

update students
set billing_gender = gender
where billing_gender is null
  and gender in ('female', 'male', 'other')
  and (
    billing_name is not null
    or billing_address is not null
    or billing_street is not null
    or billing_postcode is not null
    or billing_city is not null
  );
