// functions/api/send-session-schedule.js
// POST /api/send-session-schedule
// Body: { course_id, student_id?, student_ids?, language? }
//
// Sends a schedule update to each enrolled student with an email
// address — the list of upcoming (non-cancelled) sessions plus the
// 24-hour cancellation policy reminder, without course confirmation
// boilerplate or AGB. Use this when sessions have been rescheduled
// mid-course. If `student_id` or `student_ids` is provided, only those
// students are emailed.
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
import { getCancellationPolicy } from './_agb.js';

const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];
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

function fmtDate(iso, language = 'de') {
  return new Date(iso).toLocaleString(language === 'en' ? 'en-GB' : 'de-CH', {
    timeZone: 'Europe/Zurich',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sessionRows(sessions, language = 'de') {
  if (!sessions.length) {
    const empty =
      language === 'en'
        ? 'No lessons are currently scheduled.'
        : 'Derzeit sind keine Lektionen geplant.';
    return `<tr><td style="padding:8px 0;font-size:13px;color:#888;">${empty}</td></tr>`;
  }
  return sessions
    .map(
      (s, i) => `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#888;width:2.4em;vertical-align:top;">${i + 1}.</td>
        <td style="padding:6px 0;font-size:13px;">${esc(fmtDate(s.scheduled_at, language))}</td>
      </tr>`
    )
    .join('');
}

function courseLabel(course, language = 'de') {
  const label = [course.level, language === 'en' ? 'course' : 'Kurs', course.course_code]
    .filter(Boolean)
    .join(' ');
  return label || (language === 'en' ? 'course' : 'Kurs');
}

function buildScheduleEmail({ course, sessions, studentFirstName, language }) {
  const isEnglish = language === 'en';
  const greetingName = studentFirstName || (isEnglish ? 'course participant' : 'Kursteilnehmer:in');
  const codeLabel = course.course_code ? ` (${course.course_code})` : '';
  const label = courseLabel(course, language);
  const copy = isEnglish
    ? {
        subject: `Updated lesson plan${codeLabel} — learning with gioia`,
        htmlLang: 'en',
        intro: `Attached is the current lesson plan for your ${label}. We are happy to have you.`,
        sessions: 'Scheduled lessons',
        cancellation: 'Cancellation and postponement',
        questions: 'If you have any questions, you can reach us at',
      }
    : {
        subject: `Aktualisierter Lektionsplan${codeLabel} — learning with gioia`,
        htmlLang: 'de',
        intro: `anbei der aktuelle Lektionsplan für deinen ${label}. Wir freuen uns, dass du dabei bist.`,
        sessions: 'Geplante Lektionen',
        cancellation: 'Absage und Verschiebung',
        questions: 'Bei Fragen erreichen Sie uns unter',
      };
  return {
    subject: copy.subject,
    html: `<!DOCTYPE html>
<html lang="${copy.htmlLang}">
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
              ${isEnglish ? 'Hello' : 'Hallo'} ${esc(greetingName)},
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">
              ${esc(copy.intro)}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px;">
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">${esc(copy.sessions)}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
              ${sessionRows(sessions, language)}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px;">
            <div style="background:#fff9e6;border-left:3px solid #d4a017;padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6d0a;">${esc(copy.cancellation)}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#333;">
                ${esc(getCancellationPolicy(language))}
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
              ${esc(copy.questions)}
              <a href="mailto:info@learningwithgioia.ch" style="color:#1a1a1a;">info@learningwithgioia.ch</a>.
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

  const [cr, sr, er] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}&select=id,course_code,level`, {
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
  if (selectedStudentIds.length) {
    recipients = recipients.filter((s) => selectedStudentIds.includes(String(s.id)));
    if (!recipients.length) {
      return errorResponse('Selected students are not enrolled or have no email address', 400);
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
        language,
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
        return { email: student.email, student_id: student.id, ok: res.ok };
      } catch (err) {
        console.error(`Schedule email error for ${student.email}:`, err?.message || err);
        return { email: student.email, student_id: student.id, ok: false };
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;

  const sentStudentIds = results.filter((r) => r.ok).map((r) => r.student_id);
  if (sentStudentIds.length) {
    const sentAt = new Date().toISOString();
    const idFilter = sentStudentIds.map((id) => `student_id.eq.${id}`).join(',');
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${course_id}&or=(${idFilter})`, {
        method: 'PATCH',
        headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ schedule_sent_at: sentAt }),
      });
    } catch (err) {
      console.error('Failed to record schedule_sent_at:', err?.message || err);
    }
  }

  return jsonResponse({ success: failed === 0, sent, failed, recipients: results });
}, 'send-session-schedule');
