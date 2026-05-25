ALTER TABLE public_group_course_slots
  ADD COLUMN IF NOT EXISTS access_code TEXT,
  ADD COLUMN IF NOT EXISTS access_label TEXT;

UPDATE public_group_course_slots
SET access_code = NULLIF(upper(regexp_replace(access_code, '\s+', '', 'g')), '')
WHERE access_code IS NOT NULL;

ALTER TABLE public_group_course_slots
  ADD CONSTRAINT public_group_course_slots_access_code_normalized
  CHECK (access_code IS NULL OR access_code = upper(regexp_replace(access_code, '\s+', '', 'g')));

CREATE INDEX IF NOT EXISTS idx_public_group_course_slots_public_unlocked
  ON public_group_course_slots (status, public_booking_enabled, weekday, start_time)
  WHERE access_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_public_group_course_slots_access_code
  ON public_group_course_slots (access_code, status, public_booking_enabled)
  WHERE access_code IS NOT NULL;
