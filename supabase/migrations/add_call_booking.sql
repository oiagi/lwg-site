-- 15-minute intro calls: recurring weekly availability windows + booked calls.
--
-- Consumed by: functions/api/_call-slots.js, functions/api/call-slots.js,
--              functions/api/book-call.js, functions/api/call-availability.js,
--              functions/api/call-bookings.js
--
-- Run in the Supabase SQL editor or via: supabase db push
--
-- Windows are wall-clock Europe/Zurich. The server slices them into 15-minute
-- slots and subtracts blocked_dates, Google Calendar FreeBusy intervals and
-- existing bookings. weekday follows ISO-8601 (1 = Monday … 7 = Sunday), which
-- matches public_group_course_slots.

CREATE TABLE IF NOT EXISTS call_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Zurich',
  active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT call_availability_valid_range CHECK (end_time > start_time),
  CONSTRAINT call_availability_quarter_hour CHECK (
    (EXTRACT(MINUTE FROM start_time)::int % 15) = 0
    AND EXTRACT(SECOND FROM start_time) = 0
    AND (EXTRACT(MINUTE FROM end_time)::int % 15) = 0
    AND EXTRACT(SECOND FROM end_time) = 0
  ),
  CONSTRAINT call_availability_unique_window UNIQUE (teacher_id, weekday, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_call_availability_active
  ON call_availability (active, teacher_id, weekday, start_time);

CREATE TABLE IF NOT EXISTS call_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes SMALLINT NOT NULL DEFAULT 15 CHECK (duration_minutes > 0),
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  topic TEXT,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'de')),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  calendar_event_id TEXT,
  meet_link TEXT,
  delivery TEXT NOT NULL DEFAULT 'pending' CHECK (delivery IN ('pending', 'calendar', 'email')),
  consent_at TIMESTAMPTZ
);

-- The actual double-booking guard. There are no transactions over PostgREST,
-- so this index — not the pre-flight availability check in book-call.js — is
-- what serialises two visitors racing for the same slot. PostgREST surfaces
-- the 23505 unique violation as HTTP 409. The partial predicate means a
-- cancelled booking does not permanently burn the slot.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_call_bookings_slot
  ON call_bookings (teacher_id, starts_at)
  WHERE status = 'booked';

CREATE INDEX IF NOT EXISTS idx_call_bookings_upcoming
  ON call_bookings (starts_at)
  WHERE status = 'booked';

CREATE INDEX IF NOT EXISTS idx_call_bookings_email
  ON call_bookings (email, starts_at);

NOTIFY pgrst, 'reload schema';
