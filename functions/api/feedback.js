// functions/api/feedback.js
// GET  /api/feedback?token=...  → the questions plus course context for the form
// POST /api/feedback            → { token, answers, other } stores the answers
//
// Public but token-gated: the token is the credential, so there is no
// origin check (same as intake.js / contract-upload.js), only rate limiting.
// Each token belongs to exactly one (student, course, kind) request and
// accepts one submission.
//
// Anonymity: the request row (course_feedback) knows the student; the
// answers go into course_feedback_responses, which only knows the course
// and the kind. Nothing in this file writes anything about the student
// next to the answers, and the notification email names no one.
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
  DEFAULT_KIND,
  NPS_MAX,
  RATING_MAX,
  TOKEN_MAX_AGE_MS,
  choiceFields,
  commentFields,
  courseDisplayName,
  feedbackQuestionsForLanguage,
  isFeedbackKind,
  kindLabel,
  npsField,
  optionLabel,
  otherKey,
  ratingFields,
  validateFeedbackSubmission,
} from './_feedback.js';
import { esc } from './_feedback-email.js';
import { sendResendEmail, NOTIFY_EMAILS } from './_email.js';

const REQUEST_SELECT = 'id,course_id,kind,language,requested_at,submitted_at';

/** The course fields the question set and the page header are built from. */
const COURSE_SELECT = 'course_code,course_type,subject,level';

/**
 * Look up a feedback request by its token and enforce the 90-day expiry.
 * Returns { row } or { error, status }.
 */
async function loadFeedbackByToken(env, token) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/course_feedback?token=eq.${encodeURIComponent(token)}&select=${REQUEST_SELECT}`,
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
  // Rows from before the two-form split have no kind yet.
  if (!isFeedbackKind(row.kind)) row.kind = DEFAULT_KIND;
  return { row };
}

/** Course code / subject / level for the page heading and the question set. */
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

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return errorResponse('Missing token', 400);

  const { row, error, status } = await loadFeedbackByToken(env, token);
  if (error) return errorResponse(error, status);

  const course = await loadCourse(env, row.course_id);
  const language = row.language === 'en' ? 'en' : 'de';

  return jsonResponse({
    language,
    kind: row.kind,
    submitted: Boolean(row.submitted_at),
    course: {
      course_code: course?.course_code || null,
      // The header names the course, so the form never asks which one it was.
      name: { de: courseDisplayName(course, 'de'), en: courseDisplayName(course, 'en') },
    },
    // Both languages: the page follows the site language switcher, which the
    // visitor can change after arriving from the email. Both are tailored to
    // the same course, so the question set does not change with the language.
    questions: {
      de: feedbackQuestionsForLanguage(row.kind, 'de', course),
      en: feedbackQuestionsForLanguage(row.kind, 'en', course),
    },
  });
}, 'feedback-get');

/** Mark a request as answered. Returns true when this call claimed it. */
async function claimRequest(env, token) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  // Filtering on submitted_at=is.null makes the one-submission rule atomic:
  // a second, concurrent post matches no rows.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/course_feedback?token=eq.${encodeURIComponent(token)}&submitted_at=is.null`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify({ submitted_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) {
    console.error('Could not claim feedback request:', await res.text());
    throw new Error('claim failed');
  }
  return (await res.json()).length > 0;
}

/** Undo claimRequest when storing the answers failed, so the student can retry. */
async function releaseRequest(env, token) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/course_feedback?token=eq.${encodeURIComponent(token)}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=minimal' },
      body: JSON.stringify({ submitted_at: null }),
    }
  );
  if (!res.ok) console.error('Could not release feedback request:', await res.text());
}

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
  const course = await loadCourse(env, row.course_id);

  const { error: validationError, answers } = validateFeedbackSubmission(row.kind, body, course);
  if (validationError) return errorResponse(validationError, 400);

  // Claim first, store second: the claim is what makes a double submit
  // impossible, and a failed store hands the claim back.
  let claimed;
  try {
    claimed = await claimRequest(env, token);
  } catch {
    return errorResponse('Could not save your feedback');
  }
  if (!claimed) return errorResponse('This feedback has already been submitted', 409);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/course_feedback_responses`, {
    method: 'POST',
    headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=minimal' },
    body: JSON.stringify({ course_id: row.course_id, kind: row.kind, answers }),
  });
  if (!insertRes.ok) {
    console.error('Could not save feedback response:', await insertRes.text());
    await releaseRequest(env, token);
    return errorResponse('Could not save your feedback');
  }

  // Best-effort notification — never fails the submission, never names anyone.
  try {
    if (env.RESEND_API_KEY) {
      const kind = row.kind;
      const nps = npsField(kind);
      const ratingRows = [...ratingFields(kind), ...(nps ? [nps] : [])]
        .filter((q) => answers[q.id] !== null && answers[q.id] !== undefined)
        .map(
          (q) =>
            `<li>${esc(q.short.en)} — <strong>${esc(String(answers[q.id]))}/${q.type === 'nps' ? NPS_MAX : RATING_MAX}</strong></li>`
        )
        .join('');

      const choiceRows = choiceFields(kind)
        .map((q) => {
          const stored = answers[q.id];
          if (!stored || (Array.isArray(stored) && !stored.length)) return '';
          const chosen = (Array.isArray(stored) ? stored : [stored])
            .map((v) => optionLabel(q, v, 'en'))
            .join(', ');
          const other = q.other && answers[otherKey(q)] ? ` (${answers[otherKey(q)]})` : '';
          return `<li>${esc(q.short.en)} — <strong>${esc(chosen + other)}</strong></li>`;
        })
        .filter(Boolean)
        .join('');

      const commentRows = commentFields(kind)
        .filter((q) => answers[q.id])
        .map((q) => `<p><em>${esc(q.en)}</em><br>${esc(answers[q.id])}</p>`)
        .join('');

      const code = course?.course_code || 'a course';
      await sendResendEmail(env.RESEND_API_KEY, {
        to: NOTIFY_EMAILS,
        subject: `New ${kindLabel(kind, 'en')} feedback — ${course?.course_code || 'course'}`,
        html: `<!DOCTYPE html><html lang="en"><body style="font-family:Georgia,serif;color:#1a1a1a;">
          <p>A student submitted ${esc(kindLabel(kind, 'en'))} feedback for ${esc(code)}. Responses are anonymous.</p>
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
