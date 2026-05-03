import { supabaseHeaders } from './_utils.js';

export const PUBLIC_COURSE_CAPACITY = 5;
export const PUBLIC_BOOKING_STATUS = 'pending_course_booking';
export const PUBLIC_BOOKING_LOCATIONS = ["teacher's home", 'classroom'];

export function formatPublicLocation(course) {
  const city = (course.location_city || '').trim();
  if (course.location === "teacher's home") {
    return city ? `Teacher's home, ${city}` : "Teacher's home";
  }

  const street = (course.location_street || '').trim();
  const number = (course.location_street_number || '').trim();
  const postal = (course.location_postal_code || '').trim();
  const line1 = [street, number].filter(Boolean).join(' ');
  const line2 = [postal, city].filter(Boolean).join(' ');
  const address = [line1, line2].filter(Boolean).join(', ');
  return address || course.location || 'Classroom';
}

export function firstUpcomingSession(course, now = new Date()) {
  return (course.sessions || [])
    .filter((session) => new Date(session.scheduled_at) > now)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
}

export function isPublicCourseEligible(course, pendingCount = 0, now = new Date()) {
  const enrolledCount = course.enrolled_count || 0;
  return (
    course.public_booking_enabled === true &&
    course.status === 'active' &&
    course.group_type === 'group' &&
    PUBLIC_BOOKING_LOCATIONS.includes(course.location) &&
    !!firstUpcomingSession(course, now) &&
    enrolledCount + pendingCount < PUBLIC_COURSE_CAPACITY
  );
}

export function publicCourseDto(course, pendingCount = 0, now = new Date()) {
  const firstSession = firstUpcomingSession(course, now);
  const enrolledCount = course.enrolled_count || 0;
  const reservedCount = enrolledCount + pendingCount;
  const spotsRemaining = Math.max(0, PUBLIC_COURSE_CAPACITY - reservedCount);

  return {
    id: course.id,
    course_code: course.course_code,
    service: course.service,
    level: course.level,
    group_type: course.group_type,
    session_length_minutes: course.session_length_minutes,
    price_per_session: course.price_per_session,
    currency: course.currency || 'CHF',
    location: course.location,
    location_text: formatPublicLocation(course),
    first_session_at: firstSession?.scheduled_at || null,
    spots_remaining: spotsRemaining,
    capacity: PUBLIC_COURSE_CAPACITY,
  };
}

export async function loadPublicCourseCandidates(env, courseId = null) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const nowISO = new Date().toISOString();
  const idFilter = courseId ? `&id=eq.${encodeURIComponent(courseId)}` : '';

  const coursesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?public_booking_enabled=is.true&status=eq.active&group_type=eq.group&location=in.("teacher's home","classroom")${idFilter}&order=course_code.asc&select=id,course_code,service,level,group_type,status,session_length_minutes,price_per_session,currency,location,location_street,location_street_number,location_postal_code,location_city,public_booking_enabled`,
    { headers: H }
  );
  if (!coursesRes.ok) {
    throw new Error(`Could not load public courses: ${await coursesRes.text()}`);
  }

  const courses = await coursesRes.json();
  if (!courses.length) return [];

  const courseIds = courses.map((course) => course.id);
  const courseFilter = courseIds.map((id) => `course_id.eq.${id}`).join(',');

  const [sessionsRes, enrolmentsRes, pendingRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/sessions?or=(${courseFilter})&scheduled_at=gt.${encodeURIComponent(nowISO)}&status=neq.cancelled&order=scheduled_at.asc&select=course_id,scheduled_at,status`,
      { headers: H }
    ),
    fetch(`${SUPABASE_URL}/rest/v1/enrolments?or=(${courseFilter})&select=course_id`, {
      headers: H,
    }),
    fetch(
      `${SUPABASE_URL}/rest/v1/enquiries?or=(${courseFilter})&status=eq.${PUBLIC_BOOKING_STATUS}&select=course_id`,
      { headers: H }
    ),
  ]);

  const sessions = sessionsRes.ok ? await sessionsRes.json() : [];
  const enrolments = enrolmentsRes.ok ? await enrolmentsRes.json() : [];
  const pendingBookings = pendingRes.ok ? await pendingRes.json() : [];

  const sessionsByCourse = {};
  for (const session of sessions) {
    (sessionsByCourse[session.course_id] ||= []).push(session);
  }

  const enrolledCountByCourse = {};
  for (const enrolment of enrolments) {
    enrolledCountByCourse[enrolment.course_id] =
      (enrolledCountByCourse[enrolment.course_id] || 0) + 1;
  }

  const pendingCountByCourse = {};
  for (const enquiry of pendingBookings) {
    pendingCountByCourse[enquiry.course_id] = (pendingCountByCourse[enquiry.course_id] || 0) + 1;
  }

  return courses.map((course) => ({
    ...course,
    sessions: sessionsByCourse[course.id] || [],
    enrolled_count: enrolledCountByCourse[course.id] || 0,
    pending_booking_count: pendingCountByCourse[course.id] || 0,
  }));
}
