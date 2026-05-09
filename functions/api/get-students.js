// functions/api/get-students.js
// GET /api/get-students?status=active|inactive|prospect|all&q=<term>&sort=name|created_at|status|customer_reference|course_count&dir=asc|desc
// GET /api/get-students?active=true|false   (backward compat, maps to status filter)
//
// Returns all students, optionally filtered by status.
// Each student includes counts of enrolled courses and linked enquiries.
// Used by the admin dashboard students tab.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { supabaseHeaders, requireAdminAuth, errorResponse, withErrorHandling } from './_utils.js';

const DB_SORTS = {
  name: {
    asc: 'last_name.asc,first_name.asc',
    desc: 'last_name.desc,first_name.desc',
  },
  created_at: {
    asc: 'created_at.asc',
    desc: 'created_at.desc',
  },
  status: {
    asc: 'status.asc,last_name.asc,first_name.asc',
    desc: 'status.desc,last_name.asc,first_name.asc',
  },
  customer_reference: {
    asc: 'customer_reference.asc,last_name.asc,first_name.asc',
    desc: 'customer_reference.desc,last_name.asc,first_name.asc',
  },
};

const DERIVED_SORTS = new Set(['course_count']);
const UNTREATED_ENQUIRY_STATUSES = new Set(['new', 'pending_course_booking']);

function cleanSearchTerm(value) {
  return (value || '').trim().replace(/[(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
}

function getSort(searchParams) {
  const sort = searchParams.get('sort') || 'name';
  const dir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  if (DB_SORTS[sort] || DERIVED_SORTS.has(sort)) return { sort, dir };
  return { sort: 'name', dir: 'asc' };
}

function compareText(a, b, dir) {
  return (
    String(a || '').localeCompare(String(b || ''), undefined, {
      sensitivity: 'base',
      numeric: true,
    }) * (dir === 'desc' ? -1 : 1)
  );
}

function sortEnrichedStudents(students, sort, dir) {
  if (sort !== 'course_count') return students;
  return [...students].sort((a, b) => {
    const delta = (a.course_count || 0) - (b.course_count || 0);
    if (delta) return dir === 'desc' ? -delta : delta;
    return (
      compareText(a.last_name, b.last_name, 'asc') || compareText(a.first_name, b.first_name, 'asc')
    );
  });
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const active = url.searchParams.get('active'); // backward compat
  const q = cleanSearchTerm(url.searchParams.get('q'));
  const { sort, dir } = getSort(url.searchParams);

  // During migration, filter on `active` column (reliable) while `status`
  // is being backfilled. Translate status param → active filter.
  let filter = '';
  if (status === 'active' || active === 'true') filter = '&active=eq.true';
  else if (status === 'inactive' || active === 'false') filter = '&active=eq.false';
  else if (status === 'prospect') filter = '&status=eq.prospect';

  const order = DB_SORTS[sort]?.[dir] || DB_SORTS.name.asc;
  const search = q
    ? `&or=(first_name.ilike.${encodeURIComponent(`*${q}*`)},last_name.ilike.${encodeURIComponent(`*${q}*`)},email.ilike.${encodeURIComponent(`*${q}*`)},phone.ilike.${encodeURIComponent(`*${q}*`)},customer_reference.ilike.${encodeURIComponent(`*${q}*`)},current_level.ilike.${encodeURIComponent(`*${q}*`)})`
    : '';
  const supabaseUrl = `${SUPABASE_URL}/rest/v1/students?order=${order}&select=id,first_name,last_name,email,phone,current_level,active,status,company_id,source,created_at,customer_reference${filter}${search}`;

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(supabaseUrl, { headers: H });
    if (!res.ok) return errorResponse('Database error');

    const students = await res.json();

    // ── Enrich with course counts and company name ──────────────────────
    // Load all companies for name lookup
    const compRes = await fetch(`${SUPABASE_URL}/rest/v1/companies?select=id,name`, { headers: H });
    const companies = compRes.ok ? await compRes.json() : [];
    const companyMap = {};
    companies.forEach((c) => {
      companyMap[c.id] = c.name;
    });

    // Load all enrolments for course counts, and linked enquiries for request flags/counts
    const [enrolRes, enquiryRes, courseRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/enrolments?select=student_id,course_id`, { headers: H }),
      fetch(
        `${SUPABASE_URL}/rest/v1/enquiries?select=id,student_id,status,service,created_at,course_id,booking_data&student_id=not.is.null&order=created_at.desc`,
        { headers: H }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/courses?select=id,course_code,course_type,level,status,group_type`,
        { headers: H }
      ),
    ]);
    const enrolments = enrolRes.ok ? await enrolRes.json() : [];
    const courses = courseRes.ok ? await courseRes.json() : [];
    const coursesById = {};
    courses.forEach((c) => {
      coursesById[c.id] = c;
    });

    const coursesByStudent = {};
    enrolments.forEach((e) => {
      const c = coursesById[e.course_id];
      if (!c) return;
      (coursesByStudent[e.student_id] ||= []).push(c);
    });

    const enquiries = enquiryRes.ok ? await enquiryRes.json() : [];
    const enquiryCountMap = {};
    const pendingRequestCountMap = {};
    const pendingRequestsByStudent = {};
    let pendingRequestTotal = 0;
    enquiries.forEach((e) => {
      enquiryCountMap[e.student_id] = (enquiryCountMap[e.student_id] || 0) + 1;
      if (UNTREATED_ENQUIRY_STATUSES.has(e.status)) {
        pendingRequestTotal += 1;
        pendingRequestCountMap[e.student_id] = (pendingRequestCountMap[e.student_id] || 0) + 1;
        (pendingRequestsByStudent[e.student_id] ||= []).push({
          id: e.id,
          status: e.status,
          service: e.service,
          created_at: e.created_at,
          course_id: e.course_id,
          course: e.course_id ? coursesById[e.course_id] || null : null,
          booking_data: e.booking_data || null,
        });
      }
    });

    const enriched = students.map((s) => {
      const studentCourses = coursesByStudent[s.id] || [];
      return {
        ...s,
        company_name: s.company_id ? companyMap[s.company_id] || '—' : null,
        course_count: studentCourses.length,
        courses: studentCourses,
        enquiry_count: enquiryCountMap[s.id] || 0,
        pending_request_count: pendingRequestCountMap[s.id] || 0,
        pending_requests: pendingRequestsByStudent[s.id] || [],
      };
    });

    return new Response(JSON.stringify(sortEnrichedStudents(enriched, sort, dir)), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Untreated-Request-Count': String(pendingRequestTotal),
      },
    });
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'get-students');
