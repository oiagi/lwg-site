// functions/api/send-questionnaire-request.js
// POST /api/send-questionnaire-request
// Body: { course_id, student_ids?, language?, preview? }
//
// Asks enrolled students of a course to fill in the pre-course questionnaire.
// Each recipient gets a course_questionnaires row with its own token and a
// private link to /<lang>/questionnaire (EN) or /<lang>/fragebogen (DE).
// Students who were asked before keep their original token, so an earlier
// email stays valid; students who already answered are skipped and counted.
// With `preview: true` nothing is sent or stored: the response is the exact
// email for the first selected student, with their real link when they have
// one and a placeholder otherwise.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, SITE_URL (optional)

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  normalizePageLanguage,
} from './_utils.js';
import { buildQuestionnaireEmail } from './_questionnaire-email.js';
import {
  ensureQuestionnaireRows,
  questionnaireLink,
  markQuestionnaireRequested,
  PREVIEW_TOKEN,
} from './_questionnaire-requests.js';
import { sendResendEmail, previewResponse, NOTIFY_EMAILS } from './_email.js';

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;
  const preview = body.preview === true;

  if (!preview && !RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return errorResponse('Email service not configured', 500);
  }

  const { course_id } = body;
  if (!course_id) return errorResponse('Missing course_id', 400);
  const hasStudentIds = Object.prototype.hasOwnProperty.call(body, 'student_ids');
  if (hasStudentIds && !Array.isArray(body.student_ids)) {
    return errorResponse('student_ids must be an array', 400);
  }
  if (hasStudentIds && !body.student_ids.length) {
    return errorResponse('No selected students', 400);
  }
  const selectedStudentIds = hasStudentIds ? body.student_ids.map((id) => String(id)) : [];
  const language = normalizePageLanguage(body.language, 'de');

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const encodedCourseId = encodeURIComponent(course_id);

  const [cr, er] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/courses?id=eq.${encodedCourseId}&select=id,course_code,course_type,subject,level`,
      { headers: H }
    ),
    fetch(`${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${encodedCourseId}&select=student_id`, {
      headers: H,
    }),
  ]);

  const courses = cr.ok ? await cr.json() : [];
  if (!courses.length) return errorResponse('Course not found', 404);
  const course = courses[0];
  const studentIds = (er.ok ? await er.json() : []).map((e) => e.student_id);

  let students = [];
  if (studentIds.length) {
    const studentFilter = studentIds.map((id) => `id.eq.${id}`).join(',');
    const studRes = await fetch(
      `${SUPABASE_URL}/rest/v1/students?or=(${studentFilter})&select=id,email,first_name`,
      { headers: H }
    );
    students = studRes.ok ? await studRes.json() : [];
  }

  let recipients = students.filter((s) => s.email);
  if (selectedStudentIds.length) {
    recipients = recipients.filter((s) => selectedStudentIds.includes(String(s.id)));
    if (!recipients.length) {
      return errorResponse('Selected students are not enrolled or have no email address', 400);
    }
  }
  if (!recipients.length) {
    return errorResponse('No enrolled students with an email address', 400);
  }

  if (preview) recipients = recipients.slice(0, 1);

  const { tokensByStudent, answered } = await ensureQuestionnaireRows({
    SUPABASE_URL,
    H,
    courseId: course_id,
    recipients,
    language,
    create: !preview,
  });

  if (preview) {
    const student = recipients[0];
    const hasAnswered = answered.has(String(student.id));
    const email = buildQuestionnaireEmail({
      course,
      firstName: student.first_name,
      questionnaireUrl: questionnaireLink({
        env,
        request,
        language,
        token: tokensByStudent[String(student.id)] || PREVIEW_TOKEN,
      }),
      language,
    });
    return previewResponse({
      to: student.email,
      subject: email.subject,
      html: email.html,
      note: hasAnswered ? 'Already answered: this student will be skipped.' : null,
    });
  }

  const toEmail = recipients.filter((s) => tokensByStudent[String(s.id)]);
  if (!toEmail.length) {
    return errorResponse('Nobody left to ask: the selected students have already answered', 400);
  }

  const results = await Promise.all(
    toEmail.map(async (student) => {
      const token = tokensByStudent[String(student.id)];
      const email = buildQuestionnaireEmail({
        course,
        firstName: student.first_name,
        questionnaireUrl: questionnaireLink({ env, request, language, token }),
        language,
      });
      try {
        const res = await sendResendEmail(RESEND_API_KEY, {
          to: [student.email],
          reply_to: NOTIFY_EMAILS,
          subject: email.subject,
          html: email.html,
        });
        if (!res.ok) {
          console.error(`Questionnaire request failed for ${student.email}:`, await res.text());
        }
        return { student_id: student.id, ok: res.ok };
      } catch (err) {
        console.error(`Questionnaire request error for ${student.email}:`, err?.message || err);
        return { student_id: student.id, ok: false };
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;

  const sentStudentIds = results.filter((r) => r.ok).map((r) => r.student_id);
  await markQuestionnaireRequested({
    SUPABASE_URL,
    H,
    courseId: course_id,
    studentIds: sentStudentIds,
    language,
  });

  return jsonResponse({
    success: failed === 0,
    sent,
    failed,
    already_answered: recipients.filter((s) => answered.has(String(s.id))).length,
  });
}, 'send-questionnaire-request');
