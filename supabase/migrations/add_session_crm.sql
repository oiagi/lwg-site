-- Session CRM: what was taught in each lesson.
--
-- A logged session can now record:
--
--   notes              free text on the session itself (sessions.notes)
--   session_topics     grammar / vocabulary tags from the extendable `topics` list
--   session_materials  references into the PDF library (`materials`), each with
--                      an optional chapter and page range, so one book can be
--                      referenced several times for different sections
--
-- The PDFs live in the private Storage bucket `materials`. The browser uploads
-- them through a short-lived signed upload URL issued by
-- create-material-upload.js; all reads go through signed download URLs. The
-- service key bypasses RLS, so the tables and bucket need no policies: RLS is
-- enabled only so anon/authenticated clients cannot read them directly.
--
-- Topics and materials are referenced with ON DELETE RESTRICT: anything a
-- lesson points to is archived instead of deleted.
--
-- Required by: functions/api/save-attendance.js, functions/api/get-courses.js,
--              functions/api/get-topics.js, functions/api/save-topic.js,
--              functions/api/get-materials.js, functions/api/save-material.js,
--              functions/api/create-material-upload.js,
--              functions/api/get-material-file.js, functions/api/delete-material.js
-- Run in the Supabase SQL editor or via:
--   supabase db push

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS topics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       TEXT NOT NULL CHECK (kind IN ('grammar', 'vocabulary')),
  name       TEXT NOT NULL,
  archived   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS topics_kind_name_key ON topics (kind, lower(name));

CREATE TABLE IF NOT EXISTS session_topics (
  session_id UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  topic_id   UUID NOT NULL REFERENCES topics (id) ON DELETE RESTRICT,
  PRIMARY KEY (session_id, topic_id)
);
CREATE INDEX IF NOT EXISTS session_topics_topic_idx ON session_topics (topic_id);

CREATE TABLE IF NOT EXISTS materials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  file_path    TEXT NOT NULL UNIQUE,
  file_name    TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes   BIGINT,
  archived     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_materials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials (id) ON DELETE RESTRICT,
  chapter     TEXT,
  pages       TEXT,
  position    INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS session_materials_session_idx ON session_materials (session_id);
CREATE INDEX IF NOT EXISTS session_materials_material_idx ON session_materials (material_id);

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_materials ENABLE ROW LEVEL SECURITY;

-- The browser uploads straight to Storage, so the bucket itself enforces the
-- type and size limits (50 MB matches MAX_MATERIAL_BYTES in _materials.js).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('materials', 'materials', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Let PostgREST pick up the new tables and column without a restart.
NOTIFY pgrst, 'reload schema';
