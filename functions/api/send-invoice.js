// functions/api/send-invoice.js
// POST /api/send-invoice
// Body: {
//   student_id, course_id, email, name, language,
//   invoice: { invoice_number, customer_reference, subject, quantity, unit_price,
//              total_amount, currency, invoice_date, due_date },
//   pdf_base64,
//   include_course_info?   (default true)  — add the course confirmation blocks
//   include_questionnaire? (default false) — add the pre-course questionnaire link
//   for_payer?             (default false) — recipient pays but is not the learner
//   preview?               — return { subject, html, … } instead of sending;
//                            no PDF needed, nothing is stored
// }
//
// Sends one invoice email with a PDF attachment and logs the invoice in
// Supabase. The Swiss QR-bill (payment part + receipt) is generated in the
// browser by public/admin/features/qr-bill-pdf.js, using the creditor data
// from /api/get-qr-bill-config, and is page 2 of the PDF by the time this
// endpoint is called.
//
// The email is the course letter (_course-letter-email.js). With
// include_course_info it doubles as the course confirmation: course details,
// lesson list, cancellation policy and the full AGB, loaded here from the
// course, its sessions and the student's enrolment (joined_at greys out
// lessons held before a late joiner joined). With include_questionnaire it
// also carries the student's personal questionnaire link, unless they have
// already answered.

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
import { sendResendEmail, previewResponse, NOTIFY_EMAILS } from './_email.js';
import { cleanFilenamePart } from './_invoice-email.js';
import { buildCourseLetterEmail } from './_course-letter-email.js';
import {
  questionnaireLinkForStudent,
  markQuestionnaireRequested,
} from './_questionnaire-requests.js';

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
  if (!body.preview && (!body.pdf_base64 || typeof body.pdf_base64 !== 'string')) {
    return 'pdf_base64 is required';
  }
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

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const invalid = validate(body || {});
  if (invalid) return errorResponse(invalid, 400);
  const preview = body.preview === true;

  if (!preview && !RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return errorResponse('Email service not configured', 500);
  }

  // Reuse a record that was previously logged when the PDF was downloaded, so
  // downloading and then sending the same invoice does not create a duplicate.
  // A genuine duplicate (already emailed/paid) is still refused.
  const existing = preview ? null : await findInvoiceByNumber(env, body.invoice.invoice_number);
  if (existing && FINALISED_STATUSES.has(existing.status)) {
    return errorResponse('Invoice number already exists. Please reopen the invoice modal.', 409);
  }

  const context = await loadCourseContext(env, body.course_id, body.student_id);
  if (context.error) return context.error;

  // The questionnaire row is made before anything is logged or sent, so a
  // missing table stops the send cleanly instead of half-way.
  const H = supabaseHeaders(env.SUPABASE_SERVICE_KEY);
  const questionnaireUrl =
    body.include_questionnaire === true
      ? await questionnaireLinkForStudent({
          env,
          request,
          H,
          courseId: body.course_id,
          studentId: body.student_id,
          language: body.language,
          preview,
        })
      : null;

  const {
    subject,
    html,
    parts: sentParts,
  } = buildCourseLetterEmail({
    language: body.language,
    parts: {
      invoice: true,
      confirmation: body.include_course_info !== false,
      questionnaire: body.include_questionnaire === true,
    },
    name: body.name || '',
    first_name: body.first_name || '',
    last_name: body.last_name || '',
    gender: body.gender || '',
    invoice: body.invoice,
    course: context.course,
    sessions: context.sessions,
    joinedAt: context.joinedAt,
    questionnaireUrl,
    forPayer: body.for_payer === true,
  });
  const filename = `${body.language === 'en' ? 'invoice' : 'rechnung'}-${cleanFilenamePart(
    body.invoice.invoice_number,
    'lwg'
  )}.pdf`;

  if (preview) {
    return previewResponse({
      to: body.email,
      subject,
      html,
      attachment: filename,
      note:
        body.include_questionnaire === true && !sentParts.questionnaire
          ? 'Questionnaire already answered, so it is left out.'
          : null,
    });
  }

  const invoiceRecord = existing || (await logInvoice(env, body, PENDING_STATUS_CANDIDATES));

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

  if (sentParts.questionnaire) {
    await markQuestionnaireRequested({
      SUPABASE_URL: env.SUPABASE_URL,
      H,
      courseId: body.course_id,
      studentIds: [body.student_id],
      language: body.language,
    });
  }

  return jsonResponse({ success: true, invoice: invoiceRecord, parts: sentParts });
}, 'send-invoice');
