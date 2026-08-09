-- Invoice cancellation (Stornorechnung) support.
--
-- 1. Redefines invoices_status_check to additionally allow:
--      'cancelled' — an original invoice after it has been cancelled
--      'storno'    — the credit-note document that cancels it
--    (Base list unchanged from add_invoice_downloaded_status.sql.)
-- 2. Adds cancels_invoice_id (storno row → original row) and cancelled_at
--    (stamped on the original when it is cancelled).
-- 3. Adds line-item columns (item_subject, item_quantity, item_unit_price)
--    so a later storno can reproduce the original line items exactly.
--    Invoices logged before this migration keep NULLs there; the admin UI
--    prefills from current course data instead and warns.
--
-- Consumed by:
--   functions/api/_invoices.js          (logInvoice persists item_* columns;
--                                        groupCourseInvoices pairs each storno
--                                        with the original via
--                                        cancels_invoice_id)
--   functions/api/cancel-invoice.js     (storno insert, original → cancelled)
--   functions/api/send-invoice.js       (finalised-status guard)
--   functions/api/invoice-archive.js    (returns item_*, cancels_invoice_id,
--                                        cancelled_at, sent_at to the overview)
--   functions/api/get-courses.js        (selects cancels_invoice_id/cancelled_at
--                                        so cancellations show on the course)
--   public/admin/features/invoices.js   (Storno modal + document)
--   public/admin/features/invoice-archive.js (cancel action, row styling,
--                                        status filters — the default view
--                                        hides cancelled + storno rows)
--   public/admin/features/courses.js    (cancelled invoice list per student)

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('open', 'pending', 'unpaid', 'overdue', 'downloaded',
                    'sent', 'paid', 'cancelled', 'storno'));

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS cancels_invoice_id uuid REFERENCES invoices(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS item_subject text,
  ADD COLUMN IF NOT EXISTS item_quantity numeric,
  ADD COLUMN IF NOT EXISTS item_unit_price numeric;

-- Storno rows have no due date — nothing is payable — but due_date was
-- created NOT NULL. Until this runs, logInvoice() falls back to using the
-- storno's issue date as due_date so cancellations still go through.
ALTER TABLE invoices
  ALTER COLUMN due_date DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
