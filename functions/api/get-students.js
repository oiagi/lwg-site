// functions/api/get-students.js
// GET /api/get-students?status=active|inactive|prospect|all
// GET /api/get-students?active=true|false   (backward compat, maps to status filter)
//
// Returns all students, optionally filtered by status.
// Each student includes counts of enrolled courses and linked enquiries.
// Used by the admin dashboard students tab.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  listResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const active = url.searchParams.get('active'); // backward compat

  // Pagination + sort params
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
  const ALLOWED_SORT = ['last_name', 'first_name', 'created_at', 'email'];
  const sort = ALLOWED_SORT.includes(url.searchParams.get('sort'))
    ? url.searchParams.get('sort')
    : 'last_name';
  const dir = url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc';

  // During migration, filter on `active` column (reliable) while `status`
  // is being backfilled. Translate status param → active filter.
  let filter = '';
  if (status === 'active' || active === 'true') filter = '&active=eq.true';
  else if (status === 'inactive' || active === 'false') filter = '&active=eq.false';
  else if (status === 'prospect') filter = '&status=eq.prospect';

  let supabaseUrl = `${SUPABASE_URL}/rest/v1/students?order=${sort}.${dir},first_name.asc&limit=${limit}&offset=${offset}&select=id,first_name,last_name,email,phone,current_level,active,status,company_id,source,created_at${filter}`;

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    const res = await fetch(supabaseUrl, { headers: { ...H, Prefer: 'count=exact' } });
    if (!res.ok) return errorResponse('Database error');

    const contentRange = res.headers.get('Content-Range');
    const total = contentRange ? parseInt(contentRange.split('/')[1] || '0', 10) : 0;
    const students = await res.json();

    // ── Enrich with course counts and company name ──────────────────────
    // Load all companies for name lookup
    const compRes = await fetch(`${SUPABASE_URL}/rest/v1/companies?select=id,name`, { headers: H });
    const companies = compRes.ok ? await compRes.json() : [];
    const companyMap = {};
    companies.forEach((c) => {
      companyMap[c.id] = c.name;
    });

    // Load all enrolments for course counts, and enquiry links for enquiry counts
    const [enrolRes, enquiryRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/enrolments?select=student_id,course_id`, { headers: H }),
      fetch(`${SUPABASE_URL}/rest/v1/enquiries?select=student_id&student_id=not.is.null`, {
        headers: H,
      }),
    ]);
    const enrolments = enrolRes.ok ? await enrolRes.json() : [];
    const courseCountMap = {};
    enrolments.forEach((e) => {
      courseCountMap[e.student_id] = (courseCountMap[e.student_id] || 0) + 1;
    });

    const enquiries = enquiryRes.ok ? await enquiryRes.json() : [];
    const enquiryCountMap = {};
    enquiries.forEach((e) => {
      enquiryCountMap[e.student_id] = (enquiryCountMap[e.student_id] || 0) + 1;
    });

    const enriched = students.map((s) => ({
      ...s,
      company_name: s.company_id ? companyMap[s.company_id] || '—' : null,
      course_count: courseCountMap[s.id] || 0,
      enquiry_count: enquiryCountMap[s.id] || 0,
    }));

    return listResponse(enriched, { total, limit, offset });
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'get-students');
