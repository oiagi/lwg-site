// functions/api/get-courses.js
// GET /api/get-courses?status=active&q=<term>&sort=created_at|course_code|service|level|status|student_count|sessions_remaining&dir=asc|desc
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

const DB_SORTS = {
  created_at: {
    asc: 'created_at.asc',
    desc: 'created_at.desc',
  },
  course_code: {
    asc: 'course_code.asc',
    desc: 'course_code.desc',
  },
  course_type: {
    asc: 'course_type.asc,course_code.asc',
    desc: 'course_type.desc,course_code.asc',
  },
  level: {
    asc: 'level.asc,course_code.asc',
    desc: 'level.desc,course_code.asc',
  },
  status: {
    asc: 'status.asc,course_code.asc',
    desc: 'status.desc,course_code.asc',
  },
};

const DERIVED_SORTS = new Set(['student_count', 'sessions_remaining']);
const STUDENT_SELECT =
  'id,first_name,last_name,gender,gender_note,email,phone,current_level,progress_notes,access_token,customer_reference,street,street_number,postcode,city,billing_name,billing_gender,billing_gender_note,billing_email,billing_phone,billing_street,billing_street_number,billing_postcode,billing_city,subjects';
const STUDENT_SELECT_COMPAT =
  'id,first_name,last_name,gender,gender_note,email,phone,current_level,progress_notes,access_token,customer_reference,street,street_number,postcode,city,billing_name,billing_email,billing_phone,billing_street,billing_street_number,billing_postcode,billing_city,subjects';
const ENROLMENT_SELECT =
  'student_id,course_id,confirmation_sent_at,schedule_sent_at,invoice_lesson_count,joined_at';
const ENROLMENT_SELECT_WITHOUT_CONFIRMATION =
  'student_id,course_id,schedule_sent_at,invoice_lesson_count,joined_at';
const ENROLMENT_SELECT_COMPAT = 'student_id,course_id,schedule_sent_at';

function cleanSearchTerm(value) {
  return (value || '').trim().replace(/[(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
}

function getSort(searchParams) {
  const sort = searchParams.get('sort') || 'created_at';
  const defaultDir = sort === 'created_at' ? 'desc' : 'asc';
  const requestedDir = searchParams.get('dir');
  const dir = requestedDir === 'asc' || requestedDir === 'desc' ? requestedDir : defaultDir;
  if (DB_SORTS[sort] || DERIVED_SORTS.has(sort)) return { sort, dir };
  return { sort: 'created_at', dir: 'desc' };
}

function compareText(a, b, dir) {
  return (
    String(a || '').localeCompare(String(b || ''), undefined, {
      sensitivity: 'base',
      numeric: true,
    }) * (dir === 'desc' ? -1 : 1)
  );
}

function sessionsRemaining(course) {
  if (!course.sessions_total) return Number.POSITIVE_INFINITY;
  return course.sessions_total - (course.sessions_completed || 0);
}

function sortEnrichedCourses(courses, sort, dir) {
  if (!DERIVED_SORTS.has(sort)) return courses;
  return [...courses].sort((a, b) => {
    const left = sort === 'student_count' ? a.students?.length || 0 : sessionsRemaining(a);
    const right = sort === 'student_count' ? b.students?.length || 0 : sessionsRemaining(b);
    const delta = left - right;
    if (delta) return dir === 'desc' ? -delta : delta;
    return compareText(a.course_code, b.course_code, 'asc');
  });
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';
  const q = cleanSearchTerm(url.searchParams.get('q'));
  const { sort, dir } = getSort(url.searchParams);

  const order = DB_SORTS[sort]?.[dir] || DB_SORTS.created_at.desc;
  const search = q
    ? `&or=(course_code.ilike.${encodeURIComponent(`*${q}*`)},course_type.ilike.${encodeURIComponent(`*${q}*`)},subject.ilike.${encodeURIComponent(`*${q}*`)},level.ilike.${encodeURIComponent(`*${q}*`)},group_type.ilike.${encodeURIComponent(`*${q}*`)},location.ilike.${encodeURIComponent(`*${q}*`)},status.ilike.${encodeURIComponent(`*${q}*`)})`
    : '';
  let coursesUrl = `${SUPABASE_URL}/rest/v1/courses?order=${order}&select=*${search}`;
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

    const companyIds = [...new Set(courses.map((c) => c.company_id).filter(Boolean))];

    const [sessRes, initialEnrolRes, certRes, pendingRes, companyRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/sessions?or=(${courseFilter})&status=neq.cancelled&order=scheduled_at.asc&select=*`,
        { headers: H }
      ),
      fetch(`${SUPABASE_URL}/rest/v1/enrolments?or=(${courseFilter})&select=${ENROLMENT_SELECT}`, {
        headers: H,
      }),
      fetch(
        `${SUPABASE_URL}/rest/v1/certificates?or=(${courseFilter})&select=student_id,course_id,sent_at&order=sent_at.desc`,
        { headers: H }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/enquiries?or=(${courseFilter})&status=eq.pending_course_booking&order=created_at.asc&select=id,created_at,course_id,student_id,lead_first,lead_last,lead_email,lead_phone,booking_data,contact_data`,
        { headers: H }
      ),
      companyIds.length
        ? fetch(
            `${SUPABASE_URL}/rest/v1/companies?or=(${companyIds.map((id) => `id.eq.${id}`).join(',')})&select=id,name`,
            { headers: H }
          )
        : Promise.resolve(null),
    ]);

    const allSessions = sessRes.ok ? await sessRes.json() : [];
    const companyNameMap = {};
    if (companyRes?.ok) {
      const comps = await companyRes.json();
      for (const c of comps) companyNameMap[c.id] = c.name;
    }
    let enrolRes = initialEnrolRes;
    if (!enrolRes.ok && enrolRes.status === 400) {
      enrolRes = await fetch(
        `${SUPABASE_URL}/rest/v1/enrolments?or=(${courseFilter})&select=${ENROLMENT_SELECT_WITHOUT_CONFIRMATION}`,
        { headers: H }
      );
      if (!enrolRes.ok && enrolRes.status === 400) {
        enrolRes = await fetch(
          `${SUPABASE_URL}/rest/v1/enrolments?or=(${courseFilter})&select=${ENROLMENT_SELECT_COMPAT}`,
          { headers: H }
        );
      }
    }
    const allEnrolments = enrolRes.ok ? await enrolRes.json() : [];
    const allCertificates = certRes.ok ? await certRes.json() : [];
    const pendingBookings = pendingRes.ok ? await pendingRes.json() : [];

    // ── Batch fetch all unique students ────────────────────────────────
    const studentIds = [...new Set(allEnrolments.map((e) => e.student_id))];
    let allStudents = [];
    if (studentIds.length) {
      const studentFilter = studentIds.map((id) => `id.eq.${id}`).join(',');
      let studRes = await fetch(
        `${SUPABASE_URL}/rest/v1/students?or=(${studentFilter})&select=${STUDENT_SELECT}`,
        { headers: H }
      );
      if (!studRes.ok && studRes.status === 400) {
        studRes = await fetch(
          `${SUPABASE_URL}/rest/v1/students?or=(${studentFilter})&select=${STUDENT_SELECT_COMPAT}`,
          { headers: H }
        );
      }
      allStudents = studRes.ok ? await studRes.json() : [];
      allStudents.forEach((student) => {
        student.billing_gender ??= null;
        student.billing_gender_note ??= null;
      });
    }

    // ── Batch fetch all invoices for these courses ───────────────────
    // Includes paid invoices so the certificate can show the amount paid.
    let allInvoices = [];
    if (courseIds.length) {
      const invFilter = courseIds.map((id) => `course_id.eq.${id}`).join(',');
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/invoices?or=(${invFilter})&select=id,invoice_number,total_amount,currency,status,issued_date,sent_at,student_id,course_id`,
        { headers: H }
      );
      if (!invRes.ok && invRes.status === 400) {
        const compatInvRes = await fetch(
          `${SUPABASE_URL}/rest/v1/invoices?or=(${invFilter})&select=id,invoice_number,total_amount,currency,status,issued_date,student_id,course_id`,
          { headers: H }
        );
        allInvoices = compatInvRes.ok ? await compatInvRes.json() : [];
      } else {
        allInvoices = invRes.ok ? await invRes.json() : [];
      }
    }

    // ── Index data by course_id for fast lookup ───────────────────────
    const sessionsByCourse = {};
    for (const s of allSessions) {
      (sessionsByCourse[s.course_id] ||= []).push(s);
    }

    const studentIdsByCourse = {};
    const confirmationSentByCourseStudent = {};
    const scheduleSentByCourseStudent = {};
    const enrolmentByCourseStudent = {};
    for (const e of allEnrolments) {
      (studentIdsByCourse[e.course_id] ||= new Set()).add(e.student_id);
      (enrolmentByCourseStudent[e.course_id] ||= {})[e.student_id] = e;
      if (e.confirmation_sent_at) {
        (confirmationSentByCourseStudent[e.course_id] ||= {})[e.student_id] =
          e.confirmation_sent_at;
      }
      if (e.schedule_sent_at) {
        (scheduleSentByCourseStudent[e.course_id] ||= {})[e.student_id] = e.schedule_sent_at;
      }
    }

    // certificates ordered desc above; first occurrence per (course, student) wins
    const certificateSentByCourseStudent = {};
    for (const c of allCertificates) {
      const byStudent = (certificateSentByCourseStudent[c.course_id] ||= {});
      if (!byStudent[c.student_id]) byStudent[c.student_id] = c.sent_at;
    }

    const studentsById = {};
    for (const s of allStudents) {
      studentsById[s.id] = s;
    }

    // openInvoicesByCourseStudent / paidInvoicesByCourseStudent
    const openInvoicesByCourseStudent = {};
    const paidInvoicesByCourseStudent = {};
    const invoiceSentByCourseStudent = {};
    for (const inv of allInvoices) {
      if (['sent', 'paid'].includes(inv.status)) {
        const byStudent = (invoiceSentByCourseStudent[inv.course_id] ||= {});
        const sentAt = inv.sent_at || inv.issued_date;
        if (
          sentAt &&
          (!byStudent[inv.student_id] || String(sentAt) > String(byStudent[inv.student_id]))
        ) {
          byStudent[inv.student_id] = sentAt;
        }
      }
      if (inv.status === 'paid') {
        const byStudent = (paidInvoicesByCourseStudent[inv.course_id] ||= {});
        (byStudent[inv.student_id] ||= []).push(inv);
      } else {
        const byStudent = (openInvoicesByCourseStudent[inv.course_id] ||= {});
        (byStudent[inv.student_id] ||= []).push(inv);
      }
    }

    const pendingBookingsByCourse = {};
    for (const booking of pendingBookings) {
      (pendingBookingsByCourse[booking.course_id] ||= []).push(booking);
    }

    // ── Enrich courses ────────────────────────────────────────────────
    const enriched = courses.map((course) => {
      const invByStudent = openInvoicesByCourseStudent[course.id] || {};
      const paidInvByStudent = paidInvoicesByCourseStudent[course.id] || {};
      const confSentByStudent = confirmationSentByCourseStudent[course.id] || {};
      const schedSentByStudent = scheduleSentByCourseStudent[course.id] || {};
      const certSentByStudent = certificateSentByCourseStudent[course.id] || {};
      const invoiceSentByStudent = invoiceSentByCourseStudent[course.id] || {};
      const enrolmentByStudent = enrolmentByCourseStudent[course.id] || {};
      return {
        ...course,
        company_name: course.company_id ? companyNameMap[course.company_id] || null : null,
        sessions: sessionsByCourse[course.id] || [],
        pending_bookings: pendingBookingsByCourse[course.id] || [],
        students: [...(studentIdsByCourse[course.id] || [])]
          .map((id) => {
            const s = studentsById[id];
            if (!s) return null;
            return {
              ...s,
              invoice_lesson_count: enrolmentByStudent[id]?.invoice_lesson_count ?? null,
              joined_at: enrolmentByStudent[id]?.joined_at ?? null,
              open_invoices: invByStudent[id] || [],
              paid_invoices: paidInvByStudent[id] || [],
              confirmation_sent_at: confSentByStudent[id] || null,
              schedule_sent_at: schedSentByStudent[id] || null,
              certificate_sent_at: certSentByStudent[id] || null,
              invoice_sent_at: invoiceSentByStudent[id] || null,
            };
          })
          .filter(Boolean),
      };
    });

    return jsonResponse(sortEnrichedCourses(enriched, sort, dir));
  } catch (err) {
    console.error('get-courses error:', err);
    return errorResponse('Connection error');
  }
}, 'get-courses');
