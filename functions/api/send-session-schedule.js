// functions/api/send-session-schedule.js
// POST /api/send-session-schedule
// Body: { course_id, student_id? }
//
// Sends a plain schedule update to each enrolled student with an email
// address — just the list of upcoming (non-cancelled) sessions, no course
// confirmation boilerplate or AGB. Use this when sessions have been
// rescheduled mid-course. If `student_id` is provided, only that student
// is emailed.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

const NOTIFY_EMAILS = ['info@oiagi.org', 'info@learningwithgioia.ch'];
const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDateDE(iso) {
  return new Date(iso).toLocaleString('de-CH', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sessionRows(sessions) {
  if (!sessions.length) {
    return `<tr><td style="padding:8px 0;font-size:13px;color:#888;">Derzeit sind keine Lektionen geplant.</td></tr>`;
  }
  return sessions
    .map(
      (s, i) => `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;width:2.4em;vertical-align:top;">${i + 1}.</td>
        <td style="padding:6px 0;font-size:13px;">${esc(fmtDateDE(s.scheduled_at))}</td>
      </tr>`
    )
    .join('');
}

function buildScheduleEmail({ course, sessions, studentFirstName }) {
  const greetingName = studentFirstName || 'Kursteilnehmer:in';
  const codeLabel = course.course_code ? ` (${course.course_code})` : '';
  return {
    subject: `Aktualisierter Lektionsplan${codeLabel} — learning with gioia`,
    html: `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr>
          <td style="background:#1a1a1a;padding:32px 40px;">
            <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 16px;">
            <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">
              Hallo ${esc(greetingName)},
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">
              anbei der aktuelle Lektionsplan für Ihren Kurs${esc(codeLabel)}.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px;">
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">Geplante Lektionen</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
              ${sessionRows(sessions)}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
              Bei Fragen erreichen Sie uns unter
              <a href="mailto:info@oiagi.org" style="color:#1a1a1a;">info@oiagi.org</a>.
            </p>
            <p style="margin:16px 0 0;font-size:13px;color:#aaa;">
              <a href="https://learningwithgioia.ch" style="color:#aaa;">learningwithgioia.ch</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return errorResponse('Email service not configured', 500);
  }

  let course_id, student_id;
  try {
    ({ course_id, student_id } = await request.json());
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!course_id) return errorResponse('Missing course_id', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const [cr, sr, er] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}&select=id,course_code`, {
      headers: H,
    }),
    fetch(
      `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${course_id}&status=neq.cancelled&order=scheduled_at.asc&select=scheduled_at,status`,
      { headers: H }
    ),
    fetch(`${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${course_id}&select=student_id`, {
      headers: H,
    }),
  ]);

  const courses = cr.ok ? await cr.json() : [];
  if (!courses.length) return errorResponse('Course not found', 404);

  const course = courses[0];
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

  let recipients = students.filter((s) => s.email);
  if (student_id) {
    recipients = recipients.filter((s) => s.id === student_id);
    if (!recipients.length) {
      return errorResponse('Student not enrolled or has no email address', 400);
    }
  }
  if (!recipients.length) {
    return errorResponse('No enrolled students with an email address', 400);
  }

  const results = await Promise.all(
    recipients.map(async (student) => {
      const email = buildScheduleEmail({
        course,
        sessions,
        studentFirstName: student.first_name || '',
      });
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [student.email],
            reply_to: NOTIFY_EMAILS,
            subject: email.subject,
            html: email.html,
          }),
        });
        if (!res.ok) {
          console.error(`Schedule email failed for ${student.email}:`, await res.text());
        }
        return { email: student.email, ok: res.ok };
      } catch (err) {
        console.error(`Schedule email error for ${student.email}:`, err?.message || err);
        return { email: student.email, ok: false };
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  return jsonResponse({ success: failed === 0, sent, failed, recipients: results });
}, 'send-session-schedule');
