// functions/api/send-course-confirmation.js
// POST /api/send-course-confirmation
// Body: { course_id, student_id?, student_ids?, language?, variant? }
//
// Sends one of the two consolidated course-info emails to each enrolled
// student with an email address:
//   variant 'confirmation'  (default) — course overview, scheduled sessions,
//                                       24-hour cancellation notice, AGB
//   variant 'starting_soon'           — the same overview shortly before the
//                                       first lesson, without the AGB repeat
// If `student_id` or `student_ids` is provided, only matching students are
// emailed.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  normalizePageLanguage,
} from './_utils.js';
import { buildConfirmationEmail, COURSE_EMAIL_VARIANTS } from './_course-confirmation-email.js';
import { sendResendEmail } from './_email.js';

const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];

const SENT_AT_COLUMN = {
  confirmation: 'confirmation_sent_at',
  starting_soon: 'starting_soon_sent_at',
};

async function loadCourseBundle(SUPABASE_URL, SUPABASE_SERVICE_KEY, courseId) {
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const [cr, sr, er] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${courseId}&select=*`, { headers: H }),
    fetch(
      `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${courseId}&status=neq.cancelled&order=scheduled_at.asc&select=scheduled_at,duration_minutes,status`,
      { headers: H }
    ),
    fetch(`${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${courseId}&select=student_id`, {
      headers: H,
    }),
  ]);

  const courses = cr.ok ? await cr.json() : [];
  if (!courses.length) return { error: errorResponse('Course not found', 404) };

  const sessions = sr.ok ? await sr.json() : [];
  const enrolments = er.ok ? await er.json() : [];
  const studentIds = enrolments.map((e) => e.student_id);

  let students = [];
  if (studentIds.length) {
    const studentFilter = studentIds.map((id) => `id.eq.${id}`).join(',');
    const studRes = await fetch(
      `${SUPABASE_URL}/rest/v1/students?or=(${studentFilter})&select=id,first_name,last_name,email`,
      { headers: H }
    );
    students = studRes.ok ? await studRes.json() : [];
  }

  return { course: courses[0], sessions, students };
}

/* Stamps the per-student send column. A database that has not run the
   matching migration yet is tolerated: the 400 naming the column is swallowed
   so a successful send is never reported as an error. */
async function markEnrolmentsSent(env, courseId, studentIds, column, sentAt) {
  if (!studentIds.length) return;
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const idFilter = studentIds.map((id) => `student_id.eq.${id}`).join(',');
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${courseId}&or=(${idFilter})`,
      {
        method: 'PATCH',
        headers: {
          ...supabaseHeaders(SUPABASE_SERVICE_KEY),
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ [column]: sentAt }),
      }
    );
    if (!res.ok) {
      const errorText = await res.text();
      if (!errorText.includes(column)) {
        console.error(`Failed to record enrolment ${column}:`, errorText);
      }
    }
  } catch (err) {
    console.error(`Failed to record enrolment ${column}:`, err?.message || err);
  }
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return errorResponse('Email service not configured', 500);
  }

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { course_id, student_id } = body;
  const studentIds = Array.isArray(body.student_ids)
    ? body.student_ids.map((id) => String(id)).filter(Boolean)
    : [];
  const language = normalizePageLanguage(body.language, 'de');
  const variant = body.variant || 'confirmation';
  if (!course_id) return errorResponse('Missing course_id', 400);
  if (!COURSE_EMAIL_VARIANTS.includes(variant)) return errorResponse('Invalid variant', 400);
  if (body.student_ids !== undefined && !studentIds.length) {
    return errorResponse('No selected students', 400);
  }

  const bundle = await loadCourseBundle(SUPABASE_URL, SUPABASE_SERVICE_KEY, course_id);
  if (bundle.error) return bundle.error;

  const { course, sessions, students } = bundle;

  let recipients = students.filter((s) => s.email);
  if (studentIds.length) {
    recipients = recipients.filter((s) => studentIds.includes(String(s.id)));
    if (!recipients.length) {
      return errorResponse('Selected students are not enrolled or have no email address', 400);
    }
  } else if (student_id) {
    recipients = recipients.filter((s) => String(s.id) === String(student_id));
    if (!recipients.length) {
      return errorResponse('Student not enrolled or has no email address', 400);
    }
  }
  if (!recipients.length) {
    return errorResponse('No enrolled students with an email address', 400);
  }

  const results = await Promise.all(
    recipients.map(async (student) => {
      const email = buildConfirmationEmail({
        course,
        sessions,
        studentFirstName: student.first_name || '',
        language,
        variant,
      });
      try {
        const res = await sendResendEmail(RESEND_API_KEY, {
          to: [student.email],
          reply_to: NOTIFY_EMAILS,
          subject: email.subject,
          html: email.html,
        });
        if (!res.ok) {
          console.error(`Course ${variant} email failed for ${student.email}:`, await res.text());
        }
        return { email: student.email, student_id: student.id, ok: res.ok };
      } catch (err) {
        console.error(`Course ${variant} email error for ${student.email}:`, err?.message || err);
        return { email: student.email, student_id: student.id, ok: false };
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;

  if (sent > 0) {
    const sentAt = new Date().toISOString();
    // The course-level stamp only ever tracked the confirmation.
    if (variant === 'confirmation') {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}`, {
          method: 'PATCH',
          headers: {
            ...supabaseHeaders(SUPABASE_SERVICE_KEY),
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ course_confirmation_sent_at: sentAt }),
        });
      } catch (err) {
        console.error('Failed to record confirmation_sent_at:', err?.message || err);
      }
    }

    const sentStudentIds = results.filter((r) => r.ok).map((r) => r.student_id);
    await markEnrolmentsSent(env, course_id, sentStudentIds, SENT_AT_COLUMN[variant], sentAt);
  }

  return jsonResponse({ success: failed === 0, sent, failed, recipients: results });
}, 'send-course-confirmation');
