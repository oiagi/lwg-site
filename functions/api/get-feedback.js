// functions/api/get-feedback.js
// GET /api/get-feedback?course_id=...&submitted_only=true
//
// Full feedback rows with the student and course they belong to. Powers
// both the responses list inside a course detail (with course_id) and the
// admin feedback tab (without). The question labels travel with the
// response so the admin never keeps its own copy of them.
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
  FEEDBACK_CHOICES,
  FEEDBACK_COLUMNS,
  FEEDBACK_COMMENTS,
  FEEDBACK_NPS,
  FEEDBACK_QUESTIONS,
  labelledAverages,
  summariseFeedback,
} from './_feedback.js';

const FEEDBACK_SELECT =
  'id,student_id,course_id,language,requested_at,submitted_at,' + FEEDBACK_COLUMNS.join(',');

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const url = new URL(request.url);
  const courseId = url.searchParams.get('course_id');
  const submittedOnly = url.searchParams.get('submitted_only') === 'true';

  const filters = [`select=${FEEDBACK_SELECT}`, 'order=requested_at.desc'];
  if (courseId) filters.push(`course_id=eq.${encodeURIComponent(courseId)}`);
  if (submittedOnly) filters.push('submitted_at=not.is.null');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/course_feedback?${filters.join('&')}`, {
    headers: H,
  });
  if (!res.ok) {
    // The table is missing until add_course_feedback.sql has been applied.
    console.error('get-feedback error:', await res.text());
    return errorResponse('Feedback table not available. Run the add_course_feedback migration.');
  }
  const rows = await res.json();

  // ── Batch fetch the students and courses these rows point at ────────
  const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
  const courseIds = [...new Set(rows.map((r) => r.course_id).filter(Boolean))];

  const [studRes, courseRes] = await Promise.all([
    studentIds.length
      ? fetch(
          `${SUPABASE_URL}/rest/v1/students?or=(${studentIds.map((id) => `id.eq.${id}`).join(',')})&select=id,first_name,last_name,email`,
          { headers: H }
        )
      : Promise.resolve(null),
    courseIds.length
      ? fetch(
          `${SUPABASE_URL}/rest/v1/courses?or=(${courseIds.map((id) => `id.eq.${id}`).join(',')})&select=id,course_code,subject,level`,
          { headers: H }
        )
      : Promise.resolve(null),
  ]);

  const studentsById = {};
  if (studRes?.ok) {
    for (const s of await studRes.json()) studentsById[s.id] = s;
  }
  const coursesById = {};
  if (courseRes?.ok) {
    for (const c of await courseRes.json()) coursesById[c.id] = c;
  }

  const responses = rows.map((row) => {
    const student = studentsById[row.student_id];
    const course = coursesById[row.course_id];
    return {
      ...row,
      student_name: [student?.first_name, student?.last_name].filter(Boolean).join(' ') || null,
      student_email: student?.email || null,
      course_code: course?.course_code || null,
      course_subject: course?.subject || null,
      course_level: course?.level || null,
    };
  });

  const summary = summariseFeedback(rows);

  return jsonResponse({
    responses,
    summary: { ...summary, averages: labelledAverages(summary.averages) },
    questions: {
      ratings: [...FEEDBACK_QUESTIONS, FEEDBACK_NPS].map((q) => ({
        id: q.id,
        column: q.column,
        label: q.short.en,
        max: q.type === 'nps' ? 10 : 5,
      })),
      // Option labels travel with the response so the admin renders the
      // stored value ('a_lot') as the text the student saw.
      choices: FEEDBACK_CHOICES.map((q) => ({
        id: q.id,
        column: q.column,
        otherColumn: q.other || null,
        label: q.short.en,
        options: q.options.map((o) => ({ value: o.value, label: o.en })),
      })),
      comments: FEEDBACK_COMMENTS.map((q) => ({
        id: q.id,
        column: q.column,
        label: q.short.en,
      })),
    },
  });
}, 'get-feedback');
