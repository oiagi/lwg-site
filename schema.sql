-- ── gioia enquiries table ─────────────────────────────────────────────
-- Run this in Supabase: SQL Editor → New query → paste → Run

create table if not exists enquiries (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null    default now(),
  status       text        not null    default 'new',
    -- values: 'new' | 'contacted' | 'confirmed' | 'cancelled'

  -- Denormalised lead fields for easy scanning in admin view
  lead_first   text,
  lead_last    text,
  lead_email   text,
  lead_phone   text,

  -- Service type for quick filtering
  service      text,
    -- values: 'language course' | 'exam prep' | 'tutoring'

  -- Full JSON payloads from the booking flow
  booking_data jsonb,
  contact_data jsonb,

  -- Internal notes field for admin use
  notes        text
);

-- Index for common admin queries
create index if not exists enquiries_status_idx    on enquiries (status);
create index if not exists enquiries_created_idx   on enquiries (created_at desc);
create index if not exists enquiries_lead_email_idx on enquiries (lead_email);

-- ── Row Level Security ────────────────────────────────────────────────
-- Enable RLS so the anon key cannot read/write directly.
-- Only the service_role key (used by Netlify Functions) has access.
alter table enquiries enable row level security;

-- No public policies — service_role bypasses RLS by default.
-- This means the table is only accessible via your Netlify Functions.
