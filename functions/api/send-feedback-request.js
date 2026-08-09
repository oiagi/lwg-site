// functions/api/send-feedback-request.js
// POST /api/send-feedback-request
// Body: { course_id, student_id?, student_ids?, language? }
//
// Asks the enrolled students of a course to fill in the course feedback
// form. Each recipient gets a course_feedback row with its own token and
// a private link to /feedback.html?token=... Students who have already
// submitted are skipped; students who were asked before keep their
// original token, so an earlier email stays valid.
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
import { courseSubjectLabel } from './_feedback.js';
import { sendResendEmail } from './_email.js';

const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function courseLabel(course, language) {
  const label = [
    courseSubjectLabel(course, language),
    course.level,
    language === 'en' ? 'course' : 'Kurs',
    course.course_code,
  ]
    .filter(Boolean)
    .join(' ');
  return label || (language === 'en' ? 'course' : 'Kurs');
}

function buildFeedbackEmail({ course, studentFirstName, feedbackUrl, language }) {
  const isEnglish = language === 'en';
  const codeLabel = course.course_code ? ` (${course.course_code})` : '';
  const label = courseLabel(course, language);
  const copy = isEnglish
    ? {
        subject: `How was your course?${codeLabel} — learning with gioia`,
        greeting: `Hi ${studentFirstName || 'there'} :)`,
        intro: `We hope you enjoyed your ${label}. Would you take three to five minutes to tell us how it went? There are no right or wrong answers — your honest opinion helps us make the next course better.`,
        btn: 'Give feedback →',
        note: 'The link is personal to you and stays valid for 90 days.',
        footer: 'If you have any questions, reply to this email or write to',
      }
    : {
        subject: `Wie war dein Kurs?${codeLabel} — learning with gioia`,
        greeting: `Hallo ${studentFirstName || 'du'} :)`,
        intro: `wir hoffen, dein ${label} hat dir gefallen. Nimmst du dir drei bis fünf Minuten Zeit, um uns zu sagen, wie es war? Es gibt keine richtigen oder falschen Antworten — deine ehrliche Meinung hilft uns, den nächsten Kurs besser zu machen.`,
        btn: 'Feedback geben →',
        note: 'Der Link ist persönlich für dich und 90 Tage lang gültig.',
        footer: 'Bei Fragen antworte einfach auf diese E-Mail oder schreib an',
      };

  return {
    subject: copy.subject,
    html: `<!DOCTYPE html>
<html lang="${isEnglish ? 'en' : 'de'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:32px 40px;">
          <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
        </td></tr>
        <tr><td style="padding:40px 40px 16px;">
          <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">${esc(copy.greeting)}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">${esc(copy.intro)}</p>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <p style="margin:0 0 12px;">
            <a href="${esc(feedbackUrl)}" style="display:inline-block;background:#1a1a1a;color:#d6eaf8;text-decoration:none;padding:10px 14px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">${esc(copy.btn)}</a>
          </p>
          <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;">${esc(copy.note)}</p>
        </td></tr>
        <tr><td style="padding:24px 40px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
            ${esc(copy.footer)}
            <a href="mailto:info@learningwithgioia.ch" style="color:#1a1a1a;">info@learningwithgioia.ch</a>.
          </p>
          <p style="margin:16px 0 0;font-size:13px;color:#aaa;">
            <a href="https://learningwithgioia.ch" style="color:#aaa;">learningwithgioia.ch</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

/**
 * Ensure every recipient has a course_feedback row. Existing rows keep
 * their token so links already in a student's inbox stay valid.
 * Returns a map of student_id -> token for the students still to be asked.
 */
async function ensureFeedbackRows({ SUPABASE_URL, H, courseId, recipients, language }) {
  const idFilter = recipients.map((s) => `student_id.eq.${s.id}`).join(',');
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/course_feedback?course_id=eq.${encodeURIComponent(courseId)}&or=(${idFilter})&select=student_id,token,submitted_at`,
    { headers: H }
  );
  if (!existingRes.ok) {
    const text = await existingRes.text();
    console.error('Could not read course_feedback:', text);
    const err = new Error('Feedback storage unavailable');
    err.statusCode = 500;
    err.userMessage = 'Feedback table not available. Run the add_course_feedback migration.';
    throw err;
  }
  const existing = await existingRes.json();

  const tokensByStudent = {};
  const alreadySubmitted = [];
  for (const row of existing) {
    if (row.submitted_at) alreadySubmitted.push(String(row.student_id));
    else tokensByStudent[String(row.student_id)] = row.token;
  }

  const newRows = recipients
    .filter(
      (s) =>
        !alreadySubmitted.includes(String(s.id)) &&
        !Object.prototype.hasOwnProperty.call(tokensByStudent, String(s.id))
    )
    .map((s) => ({
      student_id: s.id,
      course_id: courseId,
      token: crypto.randomUUID(),
      language,
    }));

  if (newRows.length) {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/course_feedback`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify(newRows),
    });
    if (!insertRes.ok) {
      console.error('Could not create course_feedback rows:', await insertRes.text());
      const err = new Error('Feedback storage failed');
      err.statusCode = 500;
      err.userMessage = 'Could not create the feedback requests.';
      throw err;
    }
    for (const row of await insertRes.json()) {
      tokensByStudent[String(row.student_id)] = row.token;
    }
  }

  return { tokensByStudent, alreadySubmitted };
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
  const hasStudentIds = Object.prototype.hasOwnProperty.call(body, 'student_ids');
  if (hasStudentIds && !Array.isArray(body.student_ids)) {
    return errorResponse('student_ids must be an array', 400);
  }
  if (hasStudentIds && !body.student_ids.length) {
    return errorResponse('No selected students', 400);
  }
  const selectedStudentIds = hasStudentIds
    ? body.student_ids.map((id) => String(id))
    : student_id
      ? [String(student_id)]
      : [];
  const language = normalizePageLanguage(body.language, 'de');
  if (!course_id) return errorResponse('Missing course_id', 400);

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

  const { tokensByStudent, alreadySubmitted } = await ensureFeedbackRows({
    SUPABASE_URL,
    H,
    courseId: course_id,
    recipients,
    language,
  });

  const toEmail = recipients.filter((s) => tokensByStudent[String(s.id)]);
  if (!toEmail.length) {
    return errorResponse('All selected students have already submitted their feedback', 400);
  }

  const base = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');

  const results = await Promise.all(
    toEmail.map(async (student) => {
      const token = tokensByStudent[String(student.id)];
      const email = buildFeedbackEmail({
        course,
        studentFirstName: student.first_name || '',
        // ?lang is part of i18n.js's language resolution, so the page opens
        // in the same language the email was written in.
        feedbackUrl: `${base}/feedback.html?token=${encodeURIComponent(token)}&lang=${language}`,
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
          console.error(`Feedback request failed for ${student.email}:`, await res.text());
        }
        return { email: student.email, student_id: student.id, ok: res.ok };
      } catch (err) {
        console.error(`Feedback request error for ${student.email}:`, err?.message || err);
        return { email: student.email, student_id: student.id, ok: false };
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
        `${SUPABASE_URL}/rest/v1/course_feedback?course_id=eq.${encodedCourseId}&or=(${idFilter})`,
        {
          method: 'PATCH',
          headers: { ...H, Prefer: 'return=minimal' },
          body: JSON.stringify({ requested_at: new Date().toISOString(), language }),
        }
      );
    } catch (err) {
      console.error('Failed to record requested_at:', err?.message || err);
    }
  }

  return jsonResponse({
    success: failed === 0,
    sent,
    failed,
    skipped: alreadySubmitted.length,
    recipients: results,
  });
}, 'send-feedback-request');
