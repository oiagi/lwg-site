-- Keep invoice numbers unique for accounting traceability.
-- Consumed by: functions/api/get-next-invoice-number.js, send-invoice.js
--
-- New course invoices are issued to individual students. Some students are not
-- linked to a company, so company_id must be optional for this flow.
--
-- The admin course overview treats any non-paid invoice as an open charge.
-- Include the statuses used by the invoice sender while preserving common
-- legacy values.

ALTER TABLE invoices ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'pending', 'unpaid', 'open', 'overdue', 'paid', 'cancelled', 'void'));

CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_unique_idx
  ON invoices(invoice_number)
  WHERE invoice_number IS NOT NULL;
