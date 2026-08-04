-- Invoices are cancelled rather than deleted, so no accounting record ever
-- disappears. A cancelled invoice keeps its number and its archived PDF but
-- moves to the "cancelled" tab in the admin invoice archive and stops counting
-- as an open charge on the course overview. The replacement invoice is issued
-- from the course page with a fresh invoice number.
--
-- Consumed by: functions/api/cancel-invoice.js, invoice-archive.js,
--              delete-invoice.js, get-courses.js

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_notified_at TIMESTAMPTZ;

-- Re-allow 'cancelled' (dropped by add_invoice_downloaded_status.sql) while
-- keeping every status the invoice sender and legacy rows rely on.
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN (
    'draft', 'open', 'pending', 'unpaid', 'overdue',
    'downloaded', 'sent', 'paid', 'cancelled', 'void'
  ));

CREATE INDEX IF NOT EXISTS invoices_cancelled_at_idx
  ON invoices(cancelled_at)
  WHERE cancelled_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
