// functions/api/send-invoice.js
// POST /api/send-invoice
// Body: {
//   student_id, course_id, email, name, language,
//   invoice: { invoice_number, customer_reference, subject, quantity, unit_price,
//              total_amount, currency, invoice_date, due_date },
//   pdf_base64
// }
//
// Sends one invoice email with a PDF attachment and logs the invoice in
// Supabase. The Swiss QR-bill (payment part + receipt) is generated in the
// browser by public/admin/features/qr-bill-pdf.js, using the creditor data
// from /api/get-qr-bill-config, and is page 2 of the PDF by the time this
// endpoint is called.
//
// The email doubles as the course confirmation: besides the amount and due
// date it carries the course details, the lesson list, the cancellation
// policy and the full AGB, loaded here from the course, its sessions and the
// student's enrolment (joined_at greys out lessons held before a late joiner
// joined).

import {
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  supabaseHeaders,
} from './_utils.js';
import {
  INVOICE_NUMBER_RE,
  PENDING_STATUS_CANDIDATES,
  FINALISED_STATUSES,
  findInvoiceByNumber,
  updateInvoiceStatus,
  archiveInvoicePdf,
  logInvoice,
} from './_invoices.js';
import { sendResendEmail, NOTIFY_EMAILS } from './_email.js';
import { cleanFilenamePart, buildInvoiceEmail } from './_invoice-email.js';

const ALLOWED_LANGUAGES = ['de', 'en'];

/* The course blocks of the email come from the same reads the course-info
   emails use (send-course-confirmation.js), plus the student's enrolment for
   joined_at. A missing course is an error; failed session or enrolment reads
   degrade to an empty lesson list / no greying rather than blocking the send. */
async function loadCourseContext(env, courseId, studentId) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const q = encodeURIComponent;

  const [cr, sr, er] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${q(courseId)}&select=*`, { headers: H }),
    fetch(
      `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${q(courseId)}&status=neq.cancelled&order=scheduled_at.asc&select=scheduled_at,duration_minutes,status`,
      { headers: H }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${q(courseId)}&student_id=eq.${q(studentId)}&select=joined_at`,
      { headers: H }
    ),
  ]);

  const courses = cr.ok ? await cr.json() : [];
  if (!courses.length) return { error: errorResponse('Course not found', 404) };

  const sessions = sr.ok ? await sr.json() : [];
  const enrolments = er.ok ? await er.json() : [];
  return { course: courses[0], sessions, joinedAt: enrolments[0]?.joined_at || null };
}

function validate(body) {
  if (!body.student_id) return 'Missing student_id';
  if (!body.course_id) return 'Missing course_id';
  if (!body.email || typeof body.email !== 'string') return 'Missing email';
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
  const { RESEND_API_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return errorResponse('Email service not configured', 500);
  }

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const invalid = validate(body || {});
  if (invalid) return errorResponse(invalid, 400);

  // Reuse a record that was previously logged when the PDF was downloaded, so
  // downloading and then sending the same invoice does not create a duplicate.
  // A genuine duplicate (already emailed/paid) is still refused.
  const existing = await findInvoiceByNumber(env, body.invoice.invoice_number);
  if (existing && FINALISED_STATUSES.has(existing.status)) {
    return errorResponse('Invoice number already exists. Please reopen the invoice modal.', 409);
  }

  const context = await loadCourseContext(env, body.course_id, body.student_id);
  if (context.error) return context.error;

  const invoiceRecord = existing || (await logInvoice(env, body, PENDING_STATUS_CANDIDATES));

  const { subject, html } = buildInvoiceEmail({
    language: body.language,
    name: body.name || '',
    first_name: body.first_name || '',
    last_name: body.last_name || '',
    gender: body.gender || '',
    invoice: body.invoice,
    course: context.course,
    sessions: context.sessions,
    joinedAt: context.joinedAt,
  });
  const filename = `${body.language === 'en' ? 'invoice' : 'rechnung'}-${cleanFilenamePart(
    body.invoice.invoice_number,
    'lwg'
  )}.pdf`;

  const res = await sendResendEmail(RESEND_API_KEY, {
    to: [body.email],
    reply_to: NOTIFY_EMAILS,
    subject,
    html,
    attachments: [
      {
        filename,
        content: body.pdf_base64,
      },
    ],
  });

  if (!res.ok) {
    console.error(`Invoice email failed for ${body.email}:`, await res.text());
    return errorResponse('Invoice email failed', 502);
  }

  await updateInvoiceStatus(env, invoiceRecord?.id, 'sent');
  if (invoiceRecord) invoiceRecord.status = 'sent';

  await archiveInvoicePdf(env, body.invoice.invoice_number, body.pdf_base64).catch((err) => {
    console.error('Invoice archive unexpected error:', err);
  });

  return jsonResponse({ success: true, invoice: invoiceRecord });
}, 'send-invoice');
