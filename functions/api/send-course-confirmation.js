// functions/api/send-course-confirmation.js
// POST /api/send-course-confirmation
// Body: { course_id, student_id?, student_ids?, language? }
//
// Sends a course confirmation email (course overview, scheduled sessions,
// 24-hour cancellation notice, AGB) to each enrolled student with an email
// address. If `student_id` or `student_ids` is provided, only matching
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
import { getCancellationPolicy, getGroupCancellationPolicy, renderAgbEmailHtml } from './_agb.js';

const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];
const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';
const COURSE_FIELDS =
  'id,course_code,subject,level,group_type,sessions_total,session_length_minutes,price_per_person_per_60min,currency,location,location_company,location_street,location_street_number,location_postal_code,location_city';

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

function formatPrice(amount, currency) {
  if (amount === null || amount === undefined) return '—';
  return `${Number(amount).toFixed(2)} ${currency || 'CHF'}`;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bookingLessonCount(course, sessions) {
  return numberOrNull(course.sessions_total) || sessions.length || null;
}

function studentBookingTotal(course, sessions) {
  const pricePer60 = numberOrNull(course.price_per_person_per_60min);
  const lessons = bookingLessonCount(course, sessions);
  if (pricePer60 === null || lessons === null) return null;

  const sessionLength = numberOrNull(course.session_length_minutes) || 60;
  return pricePer60 * lessons * (sessionLength / 60);
}

function formatLocation(course) {
  const company = course.location_company;
  const line1 = [course.location_street, course.location_street_number].filter(Boolean).join(' ');
  const line2 = [course.location_postal_code, course.location_city].filter(Boolean).join(' ');
  const address = [company, line1, line2].filter(Boolean).join(', ');
  return address || course.location || '—';
}

function courseDetailRows(course, sessions, language = 'de') {
  const lessons = bookingLessonCount(course, sessions);
  const total = studentBookingTotal(course, sessions);
  const label = {
    de: {
      code: 'Kurscode',
      subject: 'Fach',
      level: 'Niveau',
      format: 'Format',
      lessons: 'Anzahl Lektionen',
      duration: 'Lektionsdauer',
      price: 'Preis pro Person / 60 Min.',
      total: 'Ihr Preis für die gesamte Buchung',
      location: 'Ort',
      open: 'offen',
    },
    en: {
      code: 'Course code',
      subject: 'Subject',
      level: 'Level',
      format: 'Format',
      lessons: 'Number of lessons',
      duration: 'Lesson duration',
      price: 'Price per person / 60 min',
      total: 'Your price for the full booking',
      location: 'Location',
      open: 'open',
    },
  }[language === 'en' ? 'en' : 'de'];
  const rows = [
    [label.code, course.course_code || '-'],
    [label.subject, course.subject || '-'],
    [label.level, course.level || '-'],
    [label.format, course.group_type || '-'],
    [label.lessons, lessons !== null ? String(lessons) : label.open],
    [label.duration, course.session_length_minutes ? `${course.session_length_minutes} min` : '-'],
    [label.price, formatPrice(course.price_per_person_per_60min, course.currency)],
    [label.total, formatPrice(total, course.currency)],
    [label.location, formatLocation(course)],
  ];
  return rows
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;white-space:nowrap;">${esc(k)}</td>
        <td style="padding:6px 0 6px 24px;font-size:13px;">${esc(v)}</td>
      </tr>`
    )
    .join('');
}

function sessionListRows(sessions, language = 'de') {
  if (!sessions.length) {
    const empty =
      language === 'en' ? 'No lessons have been scheduled yet.' : 'Noch keine Lektionen geplant.';
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

function buildConfirmationEmail({ course, sessions, studentFirstName, language }) {
  const isEnglish = language === 'en';
  const greetingName = studentFirstName || (isEnglish ? 'course participant' : 'Kursteilnehmer:in');
  const copy = isEnglish
    ? {
        subject: `Course confirmation - ${course.course_code || 'your course'} · learning with gioia`,
        htmlLang: 'en',
        title: 'Course confirmation',
        intro: `Thank you for your registration, ${greetingName} :) We look forward to learning with you soon. Below you will find all the important information about your course. Any questions? Just write to us at info@learningwithgioia.ch`,
        details: 'Course details',
        sessions: 'Scheduled lessons',
        cancellation: 'Cancellation and postponement',
        questions: 'If you have any questions, you can reach us at',
      }
    : {
        subject: `Kursbestätigung - ${course.course_code || 'dein Kurs'} · learning with gioia`,
        htmlLang: 'de',
        title: 'Kursbestätigung',
        intro: `Vielen Dank für deine Anmeldung, ${greetingName} :) Wir freuen uns darauf, bald mit dir zu lernen. Unten findest du alle wichtigen Infos zu deinem Kurs. Noch Fragen? Dann schreib uns einfach auf info@learningwithgioia.ch`,
        details: 'Kursdetails',
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
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;width:100%;">
        <tr>
          <td style="background:#1a1a1a;padding:32px 40px;">
            <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 16px;">
            <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">
              ${esc(copy.title)}
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">
              ${esc(copy.intro)}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px;">
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">${esc(copy.details)}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
              ${courseDetailRows(course, sessions, language)}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px;">
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">${esc(copy.sessions)}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
              ${sessionListRows(sessions, language)}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 24px;">
            <div style="background:#fff9e6;border-left:3px solid #d4a017;padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a6d0a;">${esc(copy.cancellation)}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#333;">
                ${esc(['duo', 'group'].includes(String(course.group_type || '').toLowerCase()) ? getGroupCancellationPolicy(language) : getCancellationPolicy(language))}
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 32px;border-top:1px solid #eee;padding-top:24px;">
            ${renderAgbEmailHtml(language)}
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

async function loadCourseBundle(SUPABASE_URL, SUPABASE_SERVICE_KEY, courseId) {
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const [cr, sr, er] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${courseId}&select=${COURSE_FIELDS}`, {
      headers: H,
    }),
    fetch(
      `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${courseId}&status=neq.cancelled&order=scheduled_at.asc&select=scheduled_at,status`,
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
  if (!course_id) return errorResponse('Missing course_id', 400);
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
          console.error(`Confirmation email failed for ${student.email}:`, await res.text());
        }
        return { email: student.email, ok: res.ok };
      } catch (err) {
        console.error(`Confirmation email error for ${student.email}:`, err?.message || err);
        return { email: student.email, ok: false };
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;

  if (sent > 0) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/courses?id=eq.${course_id}`, {
        method: 'PATCH',
        headers: {
          ...supabaseHeaders(SUPABASE_SERVICE_KEY),
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ course_confirmation_sent_at: new Date().toISOString() }),
      });
    } catch (err) {
      console.error('Failed to record confirmation_sent_at:', err?.message || err);
    }
  }

  return jsonResponse({ success: failed === 0, sent, failed, recipients: results });
}, 'send-course-confirmation');
