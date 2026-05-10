// functions/api/get-student-detail.js
// GET /api/get-student-detail?id=<uuid>
//
// Returns a single student with all fields, their enrolled courses,
// and company info. Used by the admin dashboard when viewing or
// editing a student.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

const UNTREATED_ENQUIRY_STATUSES = new Set(['new', 'pending_course_booking']);
const STUDENT_DETAIL_FIELDS = [
  'id',
  'first_name',
  'last_name',
  'gender',
  'gender_note',
  'email',
  'phone',
  'postcode',
  'street',
  'street_number',
  'city',
  'current_level',
  'progress_notes',
  'company_id',
  'active',
  'status',
  'source',
  'created_at',
  'billing_name',
  'billing_address',
  'billing_phone',
  'billing_email',
  'billing_street',
  'billing_street_number',
  'billing_postcode',
  'billing_city',
  'rate_per_session',
  'currency',
  'vat_number',
  'nationality',
  'native_language',
  'target_language',
  'learning_goals',
  'emergency_contact',
  'ec_phone',
  'ec_email',
  'ec_relationship',
  'desired_start_date',
  'referral_source',
  'payment_method',
  'course_type',
  'course_format',
  'location',
  'service',
  'grade',
  'subjects',
  'consent_given',
  'consent_date',
  'intake_completed_at',
  'intake_token',
  'intake_token_created_at',
  'access_token',
  'token_created_at',
].join(',');

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('Missing id parameter', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    // ── Load student ────────────────────────────────────────────────────
    const stuRes = await fetch(
      `${SUPABASE_URL}/rest/v1/students?id=eq.${id}&select=${STUDENT_DETAIL_FIELDS}`,
      {
        headers: H,
      }
    );
    const students = await stuRes.json();
    if (!students.length) return errorResponse('Student not found', 404);
    const student = students[0];

    // ── Load enrolments + courses ───────────────────────────────────────
    const enrolRes = await fetch(
      `${SUPABASE_URL}/rest/v1/enrolments?student_id=eq.${id}&select=course_id`,
      { headers: H }
    );
    const enrolments = enrolRes.ok ? await enrolRes.json() : [];
    const courseIds = enrolments.map((e) => e.course_id);

    let courses = [];
    if (courseIds.length) {
      const courseFilter = courseIds.map((cid) => `id.eq.${cid}`).join(',');
      const courseRes = await fetch(
        `${SUPABASE_URL}/rest/v1/courses?or=(${courseFilter})&select=id,course_code,course_type,level,group_type,status,sessions_total,sessions_completed,session_length_minutes,price_per_session,price_per_person_per_60min,currency,location`,
        { headers: H }
      );
      courses = courseRes.ok ? await courseRes.json() : [];
    }

    // ── Load company name, enquiries, and invoices in parallel ──────────
    const [compRes, enquiriesRes, invoicesRes] = await Promise.all([
      student.company_id
        ? fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${student.company_id}&select=id,name`, {
            headers: H,
          })
        : Promise.resolve(null),
      fetch(
        `${SUPABASE_URL}/rest/v1/enquiries?student_id=eq.${id}&order=created_at.desc&select=id,status,service,created_at,course_id,booking_data,lead_first,lead_last,lead_email`,
        { headers: H }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/invoices?student_id=eq.${id}&order=issued_date.desc&select=id,invoice_number,total_amount,currency,status,issued_date,course_id`,
        { headers: H }
      ),
    ]);

    let company_name = null;
    if (compRes) {
      const comps = compRes.ok ? await compRes.json() : [];
      if (comps.length) company_name = comps[0].name;
    }

    const enquiries = enquiriesRes.ok ? await enquiriesRes.json() : [];
    const invoices = invoicesRes.ok ? await invoicesRes.json() : [];
    const enquiryCourseIds = [...new Set(enquiries.map((e) => e.course_id).filter(Boolean))];
    let enquiryCourses = [];
    if (enquiryCourseIds.length) {
      const enquiryCourseFilter = enquiryCourseIds.map((cid) => `id.eq.${cid}`).join(',');
      const enquiryCourseRes = await fetch(
        `${SUPABASE_URL}/rest/v1/courses?or=(${enquiryCourseFilter})&select=id,course_code,course_type,level,status,group_type`,
        { headers: H }
      );
      enquiryCourses = enquiryCourseRes.ok ? await enquiryCourseRes.json() : [];
    }
    const enquiryCoursesById = {};
    enquiryCourses.forEach((course) => {
      enquiryCoursesById[course.id] = course;
    });
    const enrichedEnquiries = enquiries.map((enquiry) => ({
      ...enquiry,
      untreated: UNTREATED_ENQUIRY_STATUSES.has(enquiry.status),
      course: enquiry.course_id ? enquiryCoursesById[enquiry.course_id] || null : null,
    }));

    return jsonResponse({
      ...student,
      company_name,
      courses,
      enquiries: enrichedEnquiries,
      pending_request_count: enrichedEnquiries.filter((enquiry) => enquiry.untreated).length,
      invoices,
    });
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}, 'get-student-detail');
