// functions/api/get-courses.js
// GET /api/get-courses?status=active
//
// Returns courses with sessions and enrolled students.
// Uses batch queries instead of per-course fetching to avoid N+1.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';

  let coursesUrl = `${SUPABASE_URL}/rest/v1/courses?order=created_at.desc&select=*`;
  if (status !== 'all') coursesUrl += `&status=eq.${status}`;

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(coursesUrl, { headers: H });
    if (!res.ok) return errorResponse('Database error');

    const courses = await res.json();
    if (!courses.length) return jsonResponse([]);

    // ── Batch fetch sessions and enrolments for all courses ────────────
    const courseIds = courses.map((c) => c.id);
    const courseFilter = courseIds.map((id) => `course_id.eq.${id}`).join(',');

    const [sessRes, enrolRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/sessions?or=(${courseFilter})&status=neq.cancelled&order=scheduled_at.asc&select=*`,
        { headers: H }
      ),
      fetch(`${SUPABASE_URL}/rest/v1/enrolments?or=(${courseFilter})&select=student_id,course_id`, {
        headers: H,
      }),
    ]);

    const allSessions = sessRes.ok ? await sessRes.json() : [];
    const allEnrolments = enrolRes.ok ? await enrolRes.json() : [];

    // ── Batch fetch all unique students ────────────────────────────────
    const studentIds = [...new Set(allEnrolments.map((e) => e.student_id))];
    let allStudents = [];
    if (studentIds.length) {
      const studentFilter = studentIds.map((id) => `id.eq.${id}`).join(',');
      const studRes = await fetch(
        `${SUPABASE_URL}/rest/v1/students?or=(${studentFilter})&select=id,first_name,last_name,email,phone,current_level,progress_notes,access_token`,
        { headers: H }
      );
      allStudents = studRes.ok ? await studRes.json() : [];
    }

    // ── Batch fetch open invoices for these courses ───────────────────
    // "Open" = anything not marked paid. Attached to the specific
    // (student_id, course_id) pair so the course overview can list
    // unpaid charges next to each enrolled student.
    let openInvoices = [];
    if (courseIds.length) {
      const invFilter = courseIds.map((id) => `course_id.eq.${id}`).join(',');
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/invoices?or=(${invFilter})&status=neq.paid&select=id,invoice_number,total_amount,currency,status,issued_date,student_id,course_id`,
        { headers: H }
      );
      openInvoices = invRes.ok ? await invRes.json() : [];
    }

    // ── Index data by course_id for fast lookup ───────────────────────
    const sessionsByCourse = {};
    for (const s of allSessions) {
      (sessionsByCourse[s.course_id] ||= []).push(s);
    }

    const studentIdsByCourse = {};
    for (const e of allEnrolments) {
      (studentIdsByCourse[e.course_id] ||= new Set()).add(e.student_id);
    }

    const studentsById = {};
    for (const s of allStudents) {
      studentsById[s.id] = s;
    }

    // invoicesByCourseStudent[course_id][student_id] = [invoice, …]
    const invoicesByCourseStudent = {};
    for (const inv of openInvoices) {
      const byStudent = (invoicesByCourseStudent[inv.course_id] ||= {});
      (byStudent[inv.student_id] ||= []).push(inv);
    }

    // ── Enrich courses ────────────────────────────────────────────────
    const enriched = courses.map((course) => {
      const invByStudent = invoicesByCourseStudent[course.id] || {};
      return {
        ...course,
        sessions: sessionsByCourse[course.id] || [],
        students: [...(studentIdsByCourse[course.id] || [])]
          .map((id) => {
            const s = studentsById[id];
            if (!s) return null;
            return { ...s, open_invoices: invByStudent[id] || [] };
          })
          .filter(Boolean),
      };
    });

    return jsonResponse(enriched);
  } catch (err) {
    console.error('get-courses error:', err);
    return errorResponse('Connection error');
  }
}, 'get-courses');
