-- Track when an invoice email was successfully sent. Legacy sent/paid
-- invoices can still fall back to issued_date in the admin UI.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS invoices_sent_at_idx
  ON invoices(sent_at)
  WHERE sent_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
