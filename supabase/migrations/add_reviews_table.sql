-- Public reviews with moderation.
-- Required by: functions/api/reviews.js, functions/api/admin-reviews.js
-- Run in the Supabase SQL editor or via: supabase db push
--
-- `language` is the language the review was written in ('en' | 'de');
-- `translation` holds the other-language version, added during approval.
-- Nothing is shown publicly until `approved` is TRUE.

CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  language    TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'de')),
  text        TEXT NOT NULL,
  translation TEXT,
  approved    BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(approved, created_at);

-- Seed the three reviews currently hardcoded on the homepage.
INSERT INTO reviews (name, language, text, translation, approved, approved_at, created_at)
VALUES
  (
    'Pascaline H.',
    'en',
    'Gioia conveys knowledge very well and accurately. My son appreciates the private lessons.',
    'Gioia vermittelt Wissen sehr gut und präzise. Mein Sohn schätzt den Einzelunterricht.',
    TRUE, now(), now() - interval '3 minutes'
  ),
  (
    'Malena F.',
    'en',
    'Gioia is an incredibly kind and dedicated tutor. What I particularly appreciate about her is that she always prepared in advance for the topics I wanted to cover with her, whether they were specific subjects or concrete questions. I also really liked that I could go through not just one subject with her, but several. She always took extra time for this and prepared specifically for each topic. This was extremely helpful for me because it meant I had a dedicated contact person for different subjects. She also often found suitable documents, exercises, or additional materials for me and sent them to me, which was really practical and helped me a lot with my studies.',
    'Gioia ist eine unglaublich liebe und engagierte Nachhilfelehrerin. Was ich an ihr besonders schätze: Sie hat sich immer im Voraus auf die Themen vorbereitet, die ich mit ihr behandeln wollte — seien es bestimmte Fächer oder konkrete Fragen. Sehr gut gefallen hat mir auch, dass ich mit ihr nicht nur ein Fach, sondern mehrere durchgehen konnte. Dafür hat sie sich immer zusätzliche Zeit genommen und sich gezielt auf jedes Thema vorbereitet. Das war enorm hilfreich für mich, denn so hatte ich eine feste Ansprechperson für verschiedene Fächer. Oft hat sie auch passende Unterlagen, Übungen oder zusätzliche Materialien für mich gefunden und mir geschickt — das war wirklich praktisch und hat mir beim Lernen sehr geholfen.',
    TRUE, now(), now() - interval '2 minutes'
  ),
  (
    'Miriam H.',
    'en',
    'Gioia is a very professional, empathetic, patient, and dedicated teacher! 10 out of 10 :-)',
    'Gioia ist eine sehr professionelle, empathische, geduldige und engagierte Lehrerin! 10 von 10 :-)',
    TRUE, now(), now() - interval '1 minute'
  );
