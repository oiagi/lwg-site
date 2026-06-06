-- Track invoice reminder metadata and the language used for the original
-- invoice email.
-- Consumed by: functions/api/send-invoice-reminder.js, invoice-archive.js

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_language TEXT;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_invoice_language_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_invoice_language_check
  CHECK (invoice_language IS NULL OR invoice_language IN ('de', 'en'));

CREATE INDEX IF NOT EXISTS invoices_reminder_sent_at_idx
  ON invoices(reminder_sent_at)
  WHERE reminder_sent_at IS NOT NULL;
