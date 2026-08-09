// functions/api/feedback.js
// GET  /api/feedback?token=...  → the questions plus course context for the form
// POST /api/feedback            → { token, ratings, comments } stores the answers
//
// Public but token-gated: the token is the credential, so there is no
// origin check (same as intake.js / contract-upload.js), only rate limiting.
// Each token belongs to exactly one (student, course) pair and accepts one
// submission.
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
import {
  FEEDBACK_COLUMNS,
  FEEDBACK_FIELDS,
  TOKEN_MAX_AGE_MS,
  courseDisplayName,
  feedbackQuestionsForLanguage,
  optionLabel,
  validateFeedbackSubmission,
} from './_feedback.js';
import { sendResendEmail } from './_email.js';

const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];

const FEEDBACK_SELECT =
  'id,student_id,course_id,language,requested_at,submitted_at,' + FEEDBACK_COLUMNS.join(',');

/** The course fields the question set and the page header are built from. */
const COURSE_SELECT = 'course_code,course_type,subject,level';

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Look up a feedback request by its token and enforce the 90-day expiry.
 * Returns { row } or { error, status }.
 */
async function loadFeedbackByToken(env, token) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/course_feedback?token=eq.${encodeURIComponent(token)}&select=${FEEDBACK_SELECT}`,
    { headers: H }
  );
  if (!res.ok) {
    console.error('course_feedback lookup failed:', await res.text());
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

/** Course code / level and the student's first name, for the page heading. */
async function loadContext(env, row) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const [courseRes, studentRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/courses?id=eq.${encodeURIComponent(row.course_id)}&select=${COURSE_SELECT}`,
      { headers: H }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/students?id=eq.${encodeURIComponent(row.student_id)}&select=first_name,last_name`,
      { headers: H }
    ),
  ]);
  const course = courseRes.ok ? (await courseRes.json())[0] || null : null;
  const student = studentRes.ok ? (await studentRes.json())[0] || null : null;
  return { course, student };
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 20, windowSeconds: 60 });
  if (rateLimitErr) return rateLimitErr;

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return errorResponse('Missing token', 400);

  const { row, error, status } = await loadFeedbackByToken(env, token);
  if (error) return errorResponse(error, status);

  const { course, student } = await loadContext(env, row);
  const language = row.language === 'en' ? 'en' : 'de';

  return jsonResponse({
    language,
    submitted: Boolean(row.submitted_at),
    student_first_name: student?.first_name || null,
    course: {
      course_code: course?.course_code || null,
      // The header names the course, so the form never asks which one it was.
      name: { de: courseDisplayName(course, 'de'), en: courseDisplayName(course, 'en') },
    },
    // Both languages: the page follows the site language switcher, which the
    // visitor can change after arriving from the email. Both are tailored to
    // the same course, so the question set does not change with the language.
    questions: {
      de: feedbackQuestionsForLanguage('de', course),
      en: feedbackQuestionsForLanguage('en', course),
    },
  });
}, 'feedback-get');

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 10, windowSeconds: 60 });
  if (rateLimitErr) return rateLimitErr;

  const { body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const token = body?.token;
  if (!token) return errorResponse('Missing token', 400);

  const { row, error, status } = await loadFeedbackByToken(env, token);
  if (error) return errorResponse(error, status);
  if (row.submitted_at) return errorResponse('This feedback has already been submitted', 409);

  // The course decides which questions were asked, so it has to be known
  // before the answers can be checked against them.
  const { course, student } = await loadContext(env, row);

  const { error: validationError, values } = validateFeedbackSubmission(body, course);
  if (validationError) return errorResponse(validationError, 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  // Filtering on submitted_at=is.null makes the one-submission rule atomic:
  // a second, concurrent post matches no rows.
  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/course_feedback?token=eq.${encodeURIComponent(token)}&submitted_at=is.null`,
    {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify({ ...values, submitted_at: new Date().toISOString() }),
    }
  );
  if (!patchRes.ok) {
    console.error('Could not save feedback:', await patchRes.text());
    return errorResponse('Could not save your feedback');
  }
  const updated = await patchRes.json();
  if (!updated.length) return errorResponse('This feedback has already been submitted', 409);

  // Best-effort notification — never fails the submission.
  try {
    if (env.RESEND_API_KEY) {
      const who =
        [student?.first_name, student?.last_name].filter(Boolean).join(' ') || 'a student';
      const ratingRows = FEEDBACK_FIELDS.filter((q) => q.type === 'scale' || q.type === 'nps')
        .filter((q) => values[q.column] !== null && values[q.column] !== undefined)
        .map(
          (q) =>
            `<li>${esc(q.short.en)} — <strong>${esc(String(values[q.column]))}/${q.type === 'nps' ? 10 : 5}</strong></li>`
        )
        .join('');

      const choiceRows = FEEDBACK_FIELDS.filter((q) => q.type === 'choice' || q.type === 'multi')
        .map((q) => {
          const stored = values[q.column];
          if (!stored || (Array.isArray(stored) && !stored.length)) return '';
          const chosen = (Array.isArray(stored) ? stored : [stored])
            .map((v) => optionLabel(q, v, 'en'))
            .join(', ');
          const other = q.other && values[q.other] ? ` (${values[q.other]})` : '';
          return `<li>${esc(q.short.en)} — <strong>${esc(chosen + other)}</strong></li>`;
        })
        .filter(Boolean)
        .join('');

      const commentRows = FEEDBACK_FIELDS.filter((q) => q.type === 'text')
        .filter((q) => values[q.column])
        .map((q) => `<p><em>${esc(q.en)}</em><br>${esc(values[q.column])}</p>`)
        .join('');
      await sendResendEmail(env.RESEND_API_KEY, {
        to: NOTIFY_EMAILS,
        subject: `New course feedback — ${course?.course_code || 'course'} · ${who}`,
        html: `<!DOCTYPE html><html lang="en"><body style="font-family:Georgia,serif;color:#1a1a1a;">
          <p>${esc(who)} submitted feedback for ${esc(course?.course_code || 'a course')}.</p>
          <ul>${ratingRows}${choiceRows}</ul>
          ${commentRows || '<p style="color:#aaa;">No written comments.</p>'}
          <p style="color:#aaa;font-size:13px;">See the feedback tab in the admin dashboard for the full list.</p>
        </body></html>`,
      });
    }
  } catch (err) {
    console.error('Feedback notification email failed:', err?.message || err);
  }

  return jsonResponse({ success: true });
}, 'feedback-post');
