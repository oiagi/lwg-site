-- Migration: Create invoices and invoice_lines tables for Swiss QR billing
-- Run this in the Supabase SQL editor

-- ── Invoices ──────────────────────────────────────────────────────────────
create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_number  text unique not null,
  company_id      uuid not null references companies(id) on delete restrict,
  issued_date     date not null default current_date,
  due_date        date not null default (current_date + interval '30 days'),
  status          text not null default 'draft'
                    check (status in ('draft','sent','paid','cancelled')),
  currency        text not null default 'CHF'
                    check (currency in ('CHF','EUR')),
  net_amount      numeric(10,2) not null default 0,
  vat_rate        numeric(5,2),
  vat_amount      numeric(10,2) not null default 0,
  total_amount    numeric(10,2) not null default 0,
  qr_reference    text,
  qr_iban         text,
  notes           text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- ── Invoice line items ────────────────────────────────────────────────────
create table if not exists invoice_lines (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references invoices(id) on delete cascade,
  session_id    uuid references sessions(id) on delete set null,
  description   text not null,
  quantity      numeric(10,2) not null default 1,
  unit_price    numeric(10,2) not null default 0,
  line_total    numeric(10,2) not null default 0
);

-- ── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_invoices_company   on invoices(company_id);
create index if not exists idx_invoices_status    on invoices(status);
create index if not exists idx_invoice_lines_inv  on invoice_lines(invoice_id);
create index if not exists idx_invoice_lines_sess on invoice_lines(session_id);

-- ── Enable RLS (service role bypasses) ────────────────────────────────────
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
