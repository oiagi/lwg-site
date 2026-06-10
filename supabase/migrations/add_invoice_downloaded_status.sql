-- Allow invoices to be logged with status 'downloaded' — recorded when the
-- admin downloads the invoice PDF without emailing it. Sending the same
-- invoice number later flips the record to 'sent' (no duplicate row).
-- Consumed by: functions/api/log-invoice-download.js, functions/api/send-invoice.js

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('open', 'pending', 'unpaid', 'overdue', 'downloaded', 'sent', 'paid'));

NOTIFY pgrst, 'reload schema';
