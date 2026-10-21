// functions/api/questionnaire.js
// GET  /api/questionnaire?token=...  → the questions plus course context for the form
// POST /api/questionnaire            → { token, answers, other } stores the answers
//
// Public but token-gated: the token is the credential, so there is no
// origin check (same as feedback.js / intake.js), only rate limiting.
// Each token belongs to exactly one (student, course) request and accepts
// one submission. Answers are stored on the request row: unlike feedback,
// the questionnaire is not anonymous.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY (optional, for the notification)

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  checkRateLimit,
} from './_utils.js';
import { courseDisplayName } from './_feedback.js';
import {
  TOKEN_MAX_AGE_MS,
  labelledAnswers,
  questionnaireForLanguage,
  syncStudentFields,
  validateQuestionnaire,
} from './_questionnaire.js';
import { esc } from './_feedback-email.js';
import { sendResendEmail, NOTIFY_EMAILS } from './_email.js';

const REQUEST_SELECT = 'id,student_id,course_id,language,requested_at,submitted_at';

/** The course fields the question set and the page header are built from. */
const COURSE_SELECT = 'course_code,course_type,subject,level';

/**
 * Look up a questionnaire request by its token and enforce the 90-day expiry.
 * Returns { row } or { error, status }.
 */
async function loadByToken(env, token) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/course_questionnaires?token=eq.${encodeURIComponent(token)}&select=${REQUEST_SELECT}`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    console.error('course_questionnaires lookup failed:', await res.text());
    return { error: 'Database error', status: 500 };
  }
  const rows = await res.json();
  if (!rows.length) return { error: 'Invalid link', status: 404 };

  const row = rows[0];
  if (row.requested_at) {
    const ageMs = Date.now() - new Date(row.requested_at).getTime();
    if (ageMs > TOKEN_MAX_AGE_MS) {
      return { error: 'This link has expired. Please contact us for a new one.', status: 410 };
    }
  }
  return { row };
}

async function loadCourse(env, courseId) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&select=${COURSE_SELECT}`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  return res.ok ? (await res.json())[0] || null : null;
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 20, windowSeconds: 60 });
  if (rateLimitErr) return rateLimitErr;

  const token = new URL(request.url).searchParams.get('token');
  if (!token) return errorResponse('Missing token', 400);

  const { row, error, status } = await loadByToken(env, token);
  if (error) return errorResponse(error, status);

  const course = await loadCourse(env, row.course_id);

  return jsonResponse({
    language: row.language === 'en' ? 'en' : 'de',
    submitted: Boolean(row.submitted_at),
    course: {
      course_code: course?.course_code || null,
      name: { de: courseDisplayName(course, 'de'), en: courseDisplayName(course, 'en') },
    },
    // Both languages: the page follows the site language switcher.
    questions: {
      de: questionnaireForLanguage('de', course),
      en: questionnaireForLanguage('en', course),
    },
  });
}, 'questionnaire-get');

/**
 * Store the answers and mark the request answered in one PATCH. Filtering
 * on submitted_at=is.null makes the one-submission rule atomic: a second,
 * concurrent post matches no rows. Returns true when this call stored them.
 */
async function storeAnswers(env, token, answers) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/course_questionnaires?token=eq.${encodeURIComponent(token)}&submitted_at=is.null`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify({ submitted_at: new Date().toISOString(), answers }),
    }
  );
  if (!res.ok) {
    console.error('Could not store questionnaire answers:', await res.text());
    throw new Error('store failed');
  }
  return (await res.json()).length > 0;
}

/** Fill the student's goals / level where they are still empty. Best effort. */
async function syncStudent(env, studentId, answers) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const url = `${SUPABASE_URL}/rest/v1/students?id=eq.${encodeURIComponent(studentId)}`;
  try {
    const res = await fetch(`${url}&select=first_name,last_name,learning_goals,current_level`, {
      headers: H,
    });
    const student = res.ok ? (await res.json())[0] || null : null;
    if (!student) return null;
    const patch = syncStudentFields(answers, student);
    if (Object.keys(patch).length) {
      const patchRes = await fetch(url, {
        method: 'PATCH',
        headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      if (!patchRes.ok) console.error('Questionnaire student sync failed:', await patchRes.text());
    }
    return student;
  } catch (err) {
    console.error('Questionnaire student sync error:', err?.message || err);
    return null;
  }
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 10, windowSeconds: 60 });
  if (rateLimitErr) return rateLimitErr;

  const { body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const token = body?.token;
  if (!token) return errorResponse('Missing token', 400);

  const { row, error, status } = await loadByToken(env, token);
  if (error) return errorResponse(error, status);
  if (row.submitted_at) return errorResponse('This questionnaire has already been submitted', 409);

  // The course decides which questions were asked.
  const course = await loadCourse(env, row.course_id);

  const { error: validationError, answers } = validateQuestionnaire(body, course);
  if (validationError) return errorResponse(validationError, 400);

  let stored;
  try {
    stored = await storeAnswers(env, token, answers);
  } catch {
    return errorResponse('Could not save your answers');
  }
  if (!stored) return errorResponse('This questionnaire has already been submitted', 409);

  const student = await syncStudent(env, row.student_id, answers);

  // Best-effort notification — never fails the submission.
  try {
    if (env.RESEND_API_KEY) {
      const name =
        [student?.first_name, student?.last_name].filter(Boolean).join(' ') || 'A student';
      const code = course?.course_code || 'a course';
      const rows = labelledAnswers(answers, course, 'en')
        .map((a) => `<p><em>${esc(a.label)}</em><br>${esc(a.text)}</p>`)
        .join('');
      await sendResendEmail(env.RESEND_API_KEY, {
        to: NOTIFY_EMAILS,
        subject: `Pre-course questionnaire — ${name} (${course?.course_code || 'course'})`,
        html: `<!DOCTYPE html><html lang="en"><body style="font-family:Georgia,serif;color:#1a1a1a;">
          <p>${esc(name)} answered the pre-course questionnaire for ${esc(code)}.</p>
          ${rows}
          <p style="color:#aaa;font-size:13px;">The answers are also on the student's page in the admin dashboard.</p>
        </body></html>`,
      });
    }
  } catch (err) {
    console.error('Questionnaire notification email failed:', err?.message || err);
  }

  return jsonResponse({ success: true });
}, 'questionnaire-post');
