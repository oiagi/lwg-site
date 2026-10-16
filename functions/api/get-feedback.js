// functions/api/get-feedback.js
// GET /api/get-feedback?course_id=...&kind=midterm|final
//
// Anonymous feedback responses with the course they belong to, plus how
// many requests went out per course and kind. Powers both the responses
// list inside a course detail (with course_id) and the admin feedback tab
// (without). The question labels travel with the response so the admin
// never keeps its own copy of them.
//
// Nothing here identifies a student: responses carry no student reference,
// and requests are only ever counted, never listed.
//
// Environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';
import {
  DEFAULT_KIND,
  feedbackQuestionLabels,
  isFeedbackKind,
  summariseByKind,
} from './_feedback.js';

const MIGRATION = 'Run the add_course_feedback_responses migration.';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const url = new URL(request.url);
  const courseId = url.searchParams.get('course_id');
  const kind = url.searchParams.get('kind');
  if (kind && !isFeedbackKind(kind)) return errorResponse('kind must be midterm or final', 400);

  const scope = [];
  if (courseId) scope.push(`course_id=eq.${encodeURIComponent(courseId)}`);
  if (kind) scope.push(`kind=eq.${kind}`);

  const [responsesRes, requestsRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/course_feedback_responses?${[
        'select=id,course_id,kind,submitted_on,answers',
        'order=submitted_on.desc,id.desc',
        ...scope,
      ].join('&')}`,
      { headers: H }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/course_feedback?${['select=course_id,kind', ...scope].join('&')}`,
      { headers: H }
    ),
  ]);
  if (!responsesRes.ok || !requestsRes.ok) {
    console.error(
      'get-feedback error:',
      await (responsesRes.ok ? requestsRes : responsesRes).text()
    );
    return errorResponse(`Feedback tables not available. ${MIGRATION}`);
  }
  const rows = await responsesRes.json();
  const requests = await requestsRes.json();

  // ── Batch fetch the courses these rows point at ─────────────────────
  const courseIds = [...new Set([...rows, ...requests].map((r) => r.course_id).filter(Boolean))];
  const coursesById = {};
  if (courseIds.length) {
    const courseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/courses?or=(${courseIds.map((id) => `id.eq.${id}`).join(',')})&select=id,course_code,subject,level`,
      { headers: H }
    );
    if (courseRes.ok) {
      for (const c of await courseRes.json()) coursesById[c.id] = c;
    }
  }

  const responses = rows.map((row) => {
    const course = coursesById[row.course_id];
    return {
      ...row,
      course_code: course?.course_code || null,
      course_subject: course?.subject || null,
      course_level: course?.level || null,
    };
  });

  // Per course and kind: how many were asked, how many answered.
  const perCourse = {};
  for (const r of requests) {
    const k = isFeedbackKind(r.kind) ? r.kind : DEFAULT_KIND;
    const entry = (perCourse[r.course_id] ||= {
      course_id: r.course_id,
      course_code: coursesById[r.course_id]?.course_code || null,
      midterm: { requested: 0, submitted: 0 },
      final: { requested: 0, submitted: 0 },
    });
    entry[k].requested += 1;
  }
  for (const r of rows) {
    const entry = (perCourse[r.course_id] ||= {
      course_id: r.course_id,
      course_code: coursesById[r.course_id]?.course_code || null,
      midterm: { requested: 0, submitted: 0 },
      final: { requested: 0, submitted: 0 },
    });
    if (entry[r.kind]) entry[r.kind].submitted += 1;
  }

  return jsonResponse({
    responses,
    courses: Object.values(perCourse),
    summary: summariseByKind(requests, rows),
    questions: {
      midterm: feedbackQuestionLabels('midterm'),
      final: feedbackQuestionLabels('final'),
    },
  });
}, 'get-feedback');
