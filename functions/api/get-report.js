// functions/api/get-report.js
// GET /api/get-report?type=overview|revenue|sessions|attendance
//
// Aggregation endpoint for the reporting tab. Returns computed
// statistics from existing tables — no new tables needed.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url  = new URL(request.url);
  const type = url.searchParams.get('type') || 'overview';
  const H    = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    switch (type) {
      case 'overview':   return jsonResponse(await buildOverview(SUPABASE_URL, H));
      case 'revenue':    return jsonResponse(await buildRevenue(SUPABASE_URL, H));
      case 'sessions':   return jsonResponse(await buildSessions(SUPABASE_URL, H));
      case 'attendance': return jsonResponse(await buildAttendance(SUPABASE_URL, H));
      default:           return errorResponse('Unknown report type', 400);
    }
  } catch (err) {
    console.error('Report error:', err);
    return errorResponse('Could not generate report');
  }
}

// ── Overview: key dashboard metrics ──────────────────────────────────
async function buildOverview(base, H) {
  const [coursesRes, studentsRes, sessionsRes, invoicesRes] = await Promise.all([
    fetch(`${base}/rest/v1/courses?status=eq.active&select=id`, { headers: H }),
    fetch(`${base}/rest/v1/students?select=id`, { headers: H }),
    fetch(`${base}/rest/v1/sessions?status=eq.scheduled&select=id,scheduled_at`, { headers: H }),
    fetch(`${base}/rest/v1/invoices?select=id,status,total_amount,currency`, { headers: H }),
  ]);

  const courses  = coursesRes.ok  ? await coursesRes.json()  : [];
  const students = studentsRes.ok ? await studentsRes.json() : [];
  const sessions = sessionsRes.ok ? await sessionsRes.json() : [];
  const invoices = invoicesRes.ok ? await invoicesRes.json() : [];

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcoming = sessions.filter(s => {
    const d = new Date(s.scheduled_at);
    return d >= now && d <= in30;
  });

  const outstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'draft')
    .reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0);

  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0);

  return {
    active_courses: courses.length,
    total_students: students.length,
    upcoming_sessions_30d: upcoming.length,
    outstanding_amount: Math.round(outstanding * 100) / 100,
    total_paid: Math.round(totalPaid * 100) / 100,
    currency: 'CHF',
  };
}

// ── Revenue: monthly invoice breakdown ───────────────────────────────
async function buildRevenue(base, H) {
  const res = await fetch(
    `${base}/rest/v1/invoices?select=id,issued_date,status,total_amount,currency&order=issued_date.desc`,
    { headers: H }
  );
  if (!res.ok) throw new Error('Could not fetch invoices');
  const invoices = await res.json();

  const months = {};
  for (const inv of invoices) {
    const month = inv.issued_date ? inv.issued_date.slice(0, 7) : 'unknown';
    if (!months[month]) {
      months[month] = { month, invoiced: 0, paid: 0, outstanding: 0, cancelled: 0, count: 0 };
    }
    const amt = parseFloat(inv.total_amount || 0);
    months[month].count++;
    months[month].invoiced += amt;
    if (inv.status === 'paid') months[month].paid += amt;
    else if (inv.status === 'cancelled') months[month].cancelled += amt;
    else months[month].outstanding += amt;
  }

  // Round all values
  const rows = Object.values(months).sort((a, b) => b.month.localeCompare(a.month));
  for (const r of rows) {
    r.invoiced    = Math.round(r.invoiced * 100) / 100;
    r.paid        = Math.round(r.paid * 100) / 100;
    r.outstanding = Math.round(r.outstanding * 100) / 100;
    r.cancelled   = Math.round(r.cancelled * 100) / 100;
  }

  return { currency: 'CHF', rows };
}

// ── Sessions: monthly session counts by status ───────────────────────
async function buildSessions(base, H) {
  const res = await fetch(
    `${base}/rest/v1/sessions?select=id,scheduled_at,status&order=scheduled_at.desc`,
    { headers: H }
  );
  if (!res.ok) throw new Error('Could not fetch sessions');
  const sessions = await res.json();

  const months = {};
  for (const s of sessions) {
    const month = s.scheduled_at ? s.scheduled_at.slice(0, 7) : 'unknown';
    if (!months[month]) {
      months[month] = { month, completed: 0, scheduled: 0, cancelled: 0, total: 0 };
    }
    months[month].total++;
    if (s.status === 'completed') months[month].completed++;
    else if (s.status === 'cancelled') months[month].cancelled++;
    else months[month].scheduled++;
  }

  return Object.values(months).sort((a, b) => b.month.localeCompare(a.month));
}

// ── Attendance: per-course attendance rates ───────────────────────────
async function buildAttendance(base, H) {
  // Get all courses with their codes
  const coursesRes = await fetch(
    `${base}/rest/v1/courses?select=id,course_code,status&order=created_at.desc`,
    { headers: H }
  );
  if (!coursesRes.ok) throw new Error('Could not fetch courses');
  const courses = await coursesRes.json();

  // Get all attendance records
  const attRes = await fetch(
    `${base}/rest/v1/attendance?select=id,session_id,student_id,present`,
    { headers: H }
  );
  const allAttendance = attRes.ok ? await attRes.json() : [];

  // Get all sessions to map session → course
  const sessRes = await fetch(
    `${base}/rest/v1/sessions?select=id,course_id`,
    { headers: H }
  );
  const allSessions = sessRes.ok ? await sessRes.json() : [];

  const sessionCourse = {};
  for (const s of allSessions) {
    sessionCourse[s.id] = s.course_id;
  }

  // Group attendance by course
  const courseAtt = {};
  for (const a of allAttendance) {
    const courseId = sessionCourse[a.session_id];
    if (!courseId) continue;
    if (!courseAtt[courseId]) courseAtt[courseId] = { total: 0, present: 0 };
    courseAtt[courseId].total++;
    if (a.present) courseAtt[courseId].present++;
  }

  const rows = courses.map(c => {
    const att = courseAtt[c.id] || { total: 0, present: 0 };
    return {
      course_code: c.course_code,
      status: c.status,
      total_records: att.total,
      present: att.present,
      absent: att.total - att.present,
      rate: att.total > 0 ? Math.round(att.present / att.total * 100) : null,
    };
  });

  // Only include courses that have attendance data, sorted by rate
  return rows.filter(r => r.total_records > 0).sort((a, b) => (b.rate || 0) - (a.rate || 0));
}
