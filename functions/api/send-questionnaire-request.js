// functions/api/send-questionnaire-request.js
// POST /api/send-questionnaire-request
// Body: { course_id, student_ids?, language? }
//
// Asks enrolled students of a course to fill in the pre-course questionnaire.
// Each recipient gets a course_questionnaires row with its own token and a
// private link to /<lang>/questionnaire (EN) or /<lang>/fragebogen (DE).
// Students who were asked before keep their original token, so an earlier
// email stays valid; students who already answered are skipped and counted.
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
import { ROUTES } from '../_i18n-content.js';
import { buildQuestionnaireEmail } from './_questionnaire-email.js';
import { sendResendEmail, NOTIFY_EMAILS } from './_email.js';

/**
 * Ensure every recipient has a course_questionnaires row. Existing rows keep
 * their token. Returns { tokensByStudent, answered } where answered is the
 * set of student ids who have already submitted.
 */
async function ensureRows({ SUPABASE_URL, H, courseId, recipients, language }) {
  const idFilter = recipients.map((s) => `student_id.eq.${s.id}`).join(',');
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/course_questionnaires?course_id=eq.${encodeURIComponent(courseId)}&or=(${idFilter})&select=student_id,token,submitted_at`,
    { headers: H }
  );
  if (!existingRes.ok) {
    console.error('Could not read course_questionnaires:', await existingRes.text());
    const err = new Error('Questionnaire storage unavailable');
    err.statusCode = 500;
    err.userMessage =
      'Questionnaire table not available. Run the add_course_questionnaires migration.';
    throw err;
  }

  const tokensByStudent = {};
  const answered = new Set();
  for (const row of await existingRes.json()) {
    if (row.submitted_at) answered.add(String(row.student_id));
    else tokensByStudent[String(row.student_id)] = row.token;
  }

  const newRows = recipients
    .filter(
      (s) =>
        !answered.has(String(s.id)) &&
        !Object.prototype.hasOwnProperty.call(tokensByStudent, String(s.id))
    )
    .map((s) => ({
      student_id: s.id,
      course_id: courseId,
      token: crypto.randomUUID(),
      language,
    }));

  if (newRows.length) {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/course_questionnaires`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify(newRows),
    });
    if (!insertRes.ok) {
      console.error('Could not create course_questionnaires rows:', await insertRes.text());
      const err = new Error('Questionnaire storage failed');
      err.statusCode = 500;
      err.userMessage = 'Could not create the questionnaire requests.';
      throw err;
    }
    for (const row of await insertRes.json()) {
      tokensByStudent[String(row.student_id)] = row.token;
    }
  }

  return { tokensByStudent, answered };
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

  const { tokensByStudent, answered } = await ensureRows({
    SUPABASE_URL,
    H,
    courseId: course_id,
    recipients,
    language,
  });

  const toEmail = recipients.filter((s) => tokensByStudent[String(s.id)]);
  if (!toEmail.length) {
    return errorResponse('Nobody left to ask: the selected students have already answered', 400);
  }

  const base = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const slug = ROUTES['/questionnaire.html'][language];

  const results = await Promise.all(
    toEmail.map(async (student) => {
      const token = tokensByStudent[String(student.id)];
      const email = buildQuestionnaireEmail({
        course,
        firstName: student.first_name,
        // ?lang is part of i18n.js's language resolution.
        questionnaireUrl: `${base}/${language}/${slug}?token=${encodeURIComponent(token)}&lang=${language}`,
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
  if (sentStudentIds.length) {
    const idFilter = sentStudentIds.map((id) => `student_id.eq.${id}`).join(',');
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/course_questionnaires?course_id=eq.${encodedCourseId}&or=(${idFilter})`,
        {
          method: 'PATCH',
          headers: { ...H, Prefer: 'return=minimal' },
          body: JSON.stringify({ requested_at: new Date().toISOString(), language }),
        }
      );
    } catch (err) {
      console.error('Failed to record questionnaire requested_at:', err?.message || err);
    }
  }

  return jsonResponse({
    success: failed === 0,
    sent,
    failed,
    already_answered: recipients.filter((s) => answered.has(String(s.id))).length,
  });
}, 'send-questionnaire-request');
