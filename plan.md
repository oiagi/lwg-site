# Swiss QR Billing System — Implementation Plan

## Context

The LWG site is a serverless app (Cloudflare Pages Functions + Supabase + vanilla JS) for a Zürich language school. Companies already have billing fields (`rate_per_session`, `currency`, `billing_address`, `billing_email`, `vat_number`), and sessions/attendance are tracked — but there is no invoice generation, PDF export, or payment tracking.

The Swiss QR bill standard (IG QR-bill v2.3, effective Nov 2025) requires structured addresses, QR reference with Modulo 10 check digit, and a 46×46mm Swiss QR Code on the payment slip.

---

## Step 1 — Database: New Supabase Tables

Create two new tables via Supabase SQL:

### `invoices`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `invoice_number` | text UNIQUE | Format: `INV-YYYYMM-NNN` |
| `company_id` | uuid FK → companies | |
| `issued_date` | date | |
| `due_date` | date | Default: issued_date + 30 days |
| `status` | text | `draft` / `sent` / `paid` / `cancelled` |
| `currency` | text | `CHF` or `EUR` |
| `total_amount` | numeric(10,2) | |
| `vat_rate` | numeric(5,2) | Nullable (e.g. 8.1%) |
| `vat_amount` | numeric(10,2) | |
| `net_amount` | numeric(10,2) | |
| `qr_reference` | text | 27-digit QR reference |
| `qr_iban` | text | QR-IBAN for payment |
| `notes` | text | |
| `paid_at` | timestamptz | |
| `created_at` | timestamptz | Default: now() |

### `invoice_lines`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `invoice_id` | uuid FK → invoices | |
| `session_id` | uuid FK → sessions | Nullable |
| `description` | text | e.g. "German B1 – 2026-03-10" |
| `quantity` | numeric(10,2) | |
| `unit_price` | numeric(10,2) | |
| `line_total` | numeric(10,2) | |

---

## Step 2 — Backend: New API Endpoints

All endpoints in `functions/api/`, following existing patterns (admin password auth, Supabase service role).

### `create-invoice.js` — `POST /api/create-invoice`
- Input: `company_id`, `session_ids[]` (completed, unbilled sessions), optional `notes`
- Logic:
  1. Fetch company (rate, currency, VAT, billing address)
  2. Fetch selected sessions with course info
  3. Generate next `invoice_number` (query max existing)
  4. Generate 27-digit QR reference (with Modulo 10 recursive check digit)
  5. Calculate line totals, net, VAT, gross
  6. Insert `invoices` + `invoice_lines` rows
- Returns: created invoice object

### `get-invoices.js` — `GET /api/get-invoices`
- Query params: `company_id`, `status` (optional filters)
- Returns: invoices list with company name, total, status

### `get-invoice-detail.js` — `GET /api/get-invoice-detail?id=...`
- Returns: full invoice + lines + company details

### `update-invoice.js` — `PATCH /api/update-invoice`
- Update `status` (mark as sent/paid/cancelled), `paid_at`, `notes`

### `generate-invoice-pdf.js` — `GET /api/generate-invoice-pdf?id=...`
- Generates a PDF with:
  - School letterhead (name, address, contact)
  - Invoice metadata (number, date, due date)
  - Line items table
  - Totals (net, VAT, gross)
  - **Swiss QR bill payment slip** at bottom (46×46mm QR code, structured address, QR-IBAN, reference)
- Library: **`swissqrbill`** (built on PDFKit) — the most mature Swiss QR bill JS library
- Returns: PDF as `application/pdf` response

> **Cloudflare Workers compatibility note**: `swissqrbill` + PDFKit run in Node.js. Cloudflare Workers supports the `nodejs_compat` flag which enables Node.js APIs. If any incompatibility arises, the PDF generation can be offloaded to a Supabase Edge Function instead.

---

## Step 3 — QR Bill Compliance (IG v2.3)

Implemented inside `generate-invoice-pdf.js` and a new `_qr-utils.js` helper:

- **Structured addresses only** (type "S") — street, house number, postal code, city, country as separate fields
- **QR-IBAN** — the school's QR-IBAN stored as an environment variable (`QR_IBAN`)
- **QR Reference** — 27-digit numeric reference with Modulo 10 recursive check digit, generated from invoice number
- **Creditor info** — school name + address from env vars (`CREDITOR_NAME`, `CREDITOR_ADDRESS`, etc.)
- **Currency** — CHF or EUR
- **Amount** — from invoice total
- **Swiss QR Code** — 46×46mm, error correction level M, Swiss cross in center

---

## Step 4 — Frontend: Admin Billing Tab

Add a "Billing" section to `admin.html` / `admin.js`:

### Invoice list view
- Table: invoice number, company, date, amount, status
- Filter by company and status
- "Create Invoice" button

### Create invoice flow
1. Select company → loads unbilled completed sessions
2. Tick sessions to include
3. Preview totals (auto-calculated from company rate)
4. Confirm → calls `POST /api/create-invoice`

### Invoice detail view
- Shows line items, totals, QR reference
- "Download PDF" button → calls `/api/generate-invoice-pdf?id=...`
- "Mark as Sent" / "Mark as Paid" buttons → calls `PATCH /api/update-invoice`

---

## Step 5 — Environment Variables

Add to Cloudflare Pages / `.dev.vars`:

| Variable | Example |
|----------|---------|
| `QR_IBAN` | `CH44 3199 9123 0008 8901 2` |
| `CREDITOR_NAME` | `Learning with Gioia` |
| `CREDITOR_STREET` | `Musterstrasse` |
| `CREDITOR_HOUSE_NUMBER` | `1` |
| `CREDITOR_POSTAL_CODE` | `8001` |
| `CREDITOR_CITY` | `Zürich` |
| `CREDITOR_COUNTRY` | `CH` |

---

## File Summary

| Action | File |
|--------|------|
| Create | `functions/api/create-invoice.js` |
| Create | `functions/api/get-invoices.js` |
| Create | `functions/api/get-invoice-detail.js` |
| Create | `functions/api/update-invoice.js` |
| Create | `functions/api/generate-invoice-pdf.js` |
| Create | `functions/api/_qr-utils.js` |
| Edit   | `admin.html` — add billing tab/section |
| Edit   | `admin.js` — add billing logic |
| Edit   | `shared.css` — billing table styles |
| SQL    | Supabase migration for `invoices` + `invoice_lines` tables |

---

## Implementation Order

1. SQL migration (tables)
2. `_qr-utils.js` (QR reference generation + Modulo 10)
3. `create-invoice.js` + `get-invoices.js` + `get-invoice-detail.js` + `update-invoice.js`
4. `generate-invoice-pdf.js` (with `swissqrbill`)
5. Frontend (admin billing tab)
6. Testing & compliance review
