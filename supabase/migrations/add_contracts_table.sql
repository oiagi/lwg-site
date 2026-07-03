-- Track course contracts sent to students and the signed copies they upload.
-- Required by: functions/api/send-contracts.js, functions/api/contract-upload.js,
--              functions/api/get-contract-file.js
-- Run in the Supabase SQL editor or via: supabase db push

CREATE TABLE IF NOT EXISTS contracts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_ref        TEXT UNIQUE NOT NULL,
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id           UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  language            TEXT NOT NULL DEFAULT 'de',
  recipient_email     TEXT,
  recipient_name      TEXT,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_uploaded_at  TIMESTAMPTZ,
  signed_file_path    TEXT,
  signed_file_name    TEXT,
  signed_content_type TEXT,
  signed_file_size    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_contracts_student ON contracts(student_id);
CREATE INDEX IF NOT EXISTS idx_contracts_course  ON contracts(course_id);

-- Private storage bucket for uploaded signed contracts. Files are only ever
-- read/written server-side with the service key, so no public access and no
-- storage RLS policies are needed.
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;
