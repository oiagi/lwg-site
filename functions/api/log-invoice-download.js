// functions/api/log-invoice-download.js
// POST /api/log-invoice-download
// Body: {
//   student_id, course_id, language,
//   invoice: { invoice_number, customer_reference, subject, quantity, unit_price,
//              total_amount, currency, invoice_date, due_date },
//   pdf_base64
// }
//
// Records an invoice with status 'downloaded' and archives the PDF, WITHOUT
// sending an email. The PDF is built client-side (same as send-invoice). When
// the same invoice number is later emailed via send-invoice.js, that record is
// flipped to 'sent' rather than duplicated.

import {
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import {
  INVOICE_NUMBER_RE,
  DOWNLOADED_STATUS_CANDIDATES,
  findInvoiceByNumber,
  logInvoice,
  archiveInvoicePdf,
} from './_invoices.js';

const ALLOWED_LANGUAGES = ['de', 'en'];

function validate(body) {
  if (!body.student_id) return 'Missing student_id';
  if (!body.course_id) return 'Missing course_id';
  if (!ALLOWED_LANGUAGES.includes(body.language)) return 'language must be one of: de, en';
  if (!body.pdf_base64 || typeof body.pdf_base64 !== 'string') return 'pdf_base64 is required';
  const inv = body.invoice || {};
  if (!inv.invoice_number) return 'Missing invoice_number';
  if (!INVOICE_NUMBER_RE.test(inv.invoice_number)) {
    return 'invoice_number must use the format LWG-YYYY-0001';
  }
  if (!inv.total_amount || Number(inv.total_amount) <= 0) return 'Missing total_amount';
  return null;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const invalid = validate(body || {});
  if (invalid) return errorResponse(invalid, 400);

  // Reuse any existing record for this number (e.g. downloaded twice, or already
  // sent) so a download never creates a duplicate row.
  const invoiceRecord =
    (await findInvoiceByNumber(env, body.invoice.invoice_number)) ||
    (await logInvoice(env, body, DOWNLOADED_STATUS_CANDIDATES));

  await archiveInvoicePdf(env, body.invoice.invoice_number, body.pdf_base64).catch((err) => {
    console.error('Invoice archive unexpected error:', err);
  });

  return jsonResponse({ success: true, invoice: invoiceRecord });
}, 'log-invoice-download');
