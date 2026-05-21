CREATE TABLE IF NOT EXISTS public_group_course_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  public_booking_enabled BOOLEAN NOT NULL DEFAULT true,
  course_type TEXT DEFAULT 'language course',
  subject TEXT,
  level TEXT,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Zurich',
  sessions_total INTEGER NOT NULL CHECK (sessions_total > 0),
  session_length_minutes INTEGER CHECK (session_length_minutes > 0),
  price_per_person_per_60min NUMERIC,
  currency TEXT NOT NULL DEFAULT 'CHF',
  capacity INTEGER NOT NULL DEFAULT 5 CHECK (capacity > 0),
  minimum_students INTEGER NOT NULL DEFAULT 3 CHECK (minimum_students > 0),
  location TEXT,
  location_company TEXT,
  location_street TEXT,
  location_street_number TEXT,
  location_postal_code TEXT,
  location_city TEXT,
  allow_reduced_lessons BOOLEAN NOT NULL DEFAULT true,
  notes TEXT
);

ALTER TABLE enquiries
  ADD COLUMN IF NOT EXISTS public_group_course_slot_id UUID REFERENCES public_group_course_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_public_group_course_slots_public
  ON public_group_course_slots (status, public_booking_enabled, weekday, start_time);

CREATE INDEX IF NOT EXISTS idx_enquiries_public_group_course_slot
  ON enquiries (public_group_course_slot_id, status);
