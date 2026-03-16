-- ══════════════════════════════════════════════════════════════════════
-- gioia database schema — v2
-- Run in Supabase: SQL Editor → New query → paste → Run
-- Safe to re-run: uses CREATE IF NOT EXISTS throughout
--
-- Tables:
--   enquiries   — booking enquiries from the website
--   teachers    — teacher records with Google OAuth tokens
--   students    — one record per person, linked across all courses
--   courses     — confirmed courses (from enquiries or manual)
--   enrolments  — joins students to courses
--   sessions    — individual lessons within a course
-- ══════════════════════════════════════════════════════════════════════


-- ── enquiries ──────────────────────────────────────────────────────────
create table if not exists enquiries (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null    default now(),
  status       text        not null    default 'new',
  lead_first   text,
  lead_last    text,
  lead_email   text,
  lead_phone   text,
  service      text,
  booking_data jsonb,
  contact_data jsonb,
  notes        text,
  course_id    uuid
);

create index if not exists enquiries_status_idx     on enquiries (status);
create index if not exists enquiries_created_idx    on enquiries (created_at desc);
create index if not exists enquiries_lead_email_idx on enquiries (lead_email);
alter table enquiries enable row level security;


-- ── teachers ───────────────────────────────────────────────────────────
create table if not exists teachers (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  name              text        not null,
  email             text        not null unique,
  google_account    text,
  calendar_id       text,
  access_token      text,
  refresh_token     text,
  token_expires_at  timestamptz,
  active            boolean     not null default true
);

alter table teachers enable row level security;

insert into teachers (name, email, google_account, calendar_id)
values ('Gioia', 'info@oiagi.org', 'gioiabirukoff@gmail.com', 'gioiabirukoff@gmail.com')
on conflict (email) do nothing;


-- ── students ───────────────────────────────────────────────────────────
-- One record per person. Matched by email on booking confirmation.
-- If the same email appears in a future booking, the existing record
-- is reused so the full history is preserved.

create table if not exists students (
  id              uuid        primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  first_name      text,
  last_name       text,
  email           text unique,
  phone           text,
  postcode        text,
  -- Private URL token for the student-facing session page (no login needed)
  access_token    text unique default gen_random_uuid()::text,
  -- Teacher notes on progress, updated after sessions
  progress_notes  text,
  -- Current CEFR level, updated as student progresses
  current_level   text,
  -- How the student found us
  source          text default 'website',
  active          boolean not null default true
);

create index if not exists students_email_idx on students (email);
alter table students enable row level security;


-- ── courses ────────────────────────────────────────────────────────────
-- course_code: {G|D|P}_{level}_{number}  e.g. G_A1_1, P_B2_3

create table if not exists courses (
  id                uuid    primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  course_code       text    unique,
  service           text,
  level             text,
  group_type        text,
  teacher_id        uuid    references teachers(id) on delete set null,
  participant_names text[],
  participants      jsonb,
  sessions_total    integer,
  sessions_completed integer not null default 0,
  calendar_event_id text,
  enquiry_id        uuid    references enquiries(id) on delete set null,
  status            text    not null default 'active',
  notes             text
);

create index if not exists courses_teacher_idx on courses (teacher_id);
create index if not exists courses_status_idx  on courses (status);
create index if not exists courses_code_idx    on courses (course_code);
alter table courses enable row level security;


-- ── enrolments ─────────────────────────────────────────────────────────
-- Joins students to courses. One row per student per course.

create table if not exists enrolments (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  student_id  uuid        not null references students(id) on delete cascade,
  course_id   uuid        not null references courses(id)  on delete cascade,
  unique (student_id, course_id)
);

create index if not exists enrolments_student_idx on enrolments (student_id);
create index if not exists enrolments_course_idx  on enrolments (course_id);
alter table enrolments enable row level security;


-- ── sessions ───────────────────────────────────────────────────────────

create table if not exists sessions (
  id                uuid    primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  course_id         uuid    not null references courses(id) on delete cascade,
  teacher_id        uuid    references teachers(id) on delete set null,
  scheduled_at      timestamptz,
  duration_minutes  integer default 50,
  status            text    not null default 'scheduled',
  calendar_event_id text,
  notes             text,
  completed_at      timestamptz
);

create index if not exists sessions_course_idx    on sessions (course_id);
create index if not exists sessions_scheduled_idx on sessions (scheduled_at);
create index if not exists sessions_status_idx    on sessions (status);
alter table sessions enable row level security;


-- ══════════════════════════════════════════════════════════════════════
-- Helper: auto-generate next course code
-- ══════════════════════════════════════════════════════════════════════

create or replace function get_next_course_code(prefix text, level_code text)
returns text language plpgsql as $$
declare
  pattern  text;
  max_num  integer;
begin
  pattern := prefix || '_' || level_code || '_%';
  select coalesce(max(cast(split_part(course_code, '_', 3) as integer)), 0)
  into max_num
  from courses
  where course_code like pattern;
  return prefix || '_' || level_code || '_' || (max_num + 1);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════
-- Migration: safe additions to existing tables
-- ══════════════════════════════════════════════════════════════════════
alter table enquiries add column if not exists course_id uuid;
alter table courses   drop column if exists calendar_watch_channel;
alter table courses   drop column if exists calendar_watch_expiry;
