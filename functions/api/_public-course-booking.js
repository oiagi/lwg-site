import { supabaseHeaders } from './_utils.js';

export const PUBLIC_COURSE_CAPACITY = 5;
export const PUBLIC_BOOKING_STATUS = 'pending_course_booking';
export const PUBLIC_SLOT_BOOKING_STATUS = 'pending_group_slot_booking';
export const PUBLIC_BOOKING_LOCATIONS = ["teacher's home", 'classroom'];
export const PUBLIC_SLOT_PREFERRED_LOCATIONS = [...PUBLIC_BOOKING_LOCATIONS, 'online', 'company'];
export const PUBLIC_BOOKING_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const WEEKDAY_NAMES = {
  1: 'Mondays',
  2: 'Tuesdays',
  3: 'Wednesdays',
  4: 'Thursdays',
  5: 'Fridays',
  6: 'Saturdays',
  7: 'Sundays',
};

function publicPricePerPerson(course) {
  if (
    course.price_per_person_per_60min !== null &&
    course.price_per_person_per_60min !== undefined
  ) {
    return course.price_per_person_per_60min;
  }
  if (course.price_per_session === null || course.price_per_session === undefined) return null;
  if (course.group_type === 'duo') return Number(course.price_per_session) / 2;
  if (course.group_type === 'group')
    return Number(course.price_per_session) / PUBLIC_COURSE_CAPACITY;
  return course.price_per_session;
}

export function formatPublicLocation(course) {
  const city = (course.location_city || '').trim();
  if (course.location === "teacher's home") {
    return city ? `Teacher's home, ${city}` : "Teacher's home";
  }

  const company = (course.location_company || '').trim();
  const street = (course.location_street || '').trim();
  const number = (course.location_street_number || '').trim();
  const postal = (course.location_postal_code || '').trim();
  const line1 = [street, number].filter(Boolean).join(' ');
  const line2 = [postal, city].filter(Boolean).join(' ');
  const address = [company, line1, line2].filter(Boolean).join(', ');
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
  const upcomingSessionCount = (course.sessions || []).length;
  const enrolledCount = course.enrolled_count || 0;
  const reservedCount = enrolledCount + pendingCount;
  const spotsRemaining = Math.max(0, PUBLIC_COURSE_CAPACITY - reservedCount);
  const sessionsCompleted = Math.max(0, Number(course.sessions_completed || 0));
  const sessionsTotal =
    course.sessions_total === null || course.sessions_total === undefined
      ? null
      : Math.max(0, Number(course.sessions_total));
  const sessionsRemaining =
    sessionsTotal === null
      ? upcomingSessionCount
      : Math.max(upcomingSessionCount, sessionsTotal - sessionsCompleted);

  return {
    kind: 'existing_course',
    id: course.id,
    course_code: course.course_code,
    course_type: course.course_type,
    service: course.course_type,
    subject: course.subject,
    level: course.level,
    group_type: course.group_type,
    session_length_minutes: course.session_length_minutes,
    price_per_session: course.price_per_session,
    price_per_person_per_60min: publicPricePerPerson(course),
    currency: course.currency || 'CHF',
    location: course.location,
    location_text: formatPublicLocation(course),
    first_session_at: firstSession?.scheduled_at || null,
    sessions_completed: sessionsCompleted,
    sessions_remaining: sessionsRemaining,
    sessions_total: sessionsTotal,
    spots_remaining: spotsRemaining,
    capacity: PUBLIC_COURSE_CAPACITY,
  };
}

function timeText(value) {
  return String(value || '').slice(0, 5);
}

export function reducedLessonCount(sessionsTotal, actualStudents, minimumStudents = 3) {
  const total = Number(sessionsTotal);
  const actual = Number(actualStudents);
  const minimum = Number(minimumStudents) || 3;
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(actual) || actual <= 0 || actual >= minimum) return total;
  return Math.max(1, Math.floor((total * actual) / minimum));
}

export function publicSlotDto(slot, pendingCount = 0) {
  const capacity = Math.max(1, Number(slot.capacity || PUBLIC_COURSE_CAPACITY));
  const minimumStudents = Math.max(1, Number(slot.minimum_students || 3));
  const reservedCount = Math.max(0, Number(pendingCount || 0));
  const spotsRemaining = Math.max(0, capacity - reservedCount);
  const weekday = WEEKDAY_NAMES[slot.weekday] || 'Weekly';
  const scheduleText = `${weekday} ${timeText(slot.start_time)}-${timeText(slot.end_time)}`;

  return {
    kind: 'planned_slot',
    id: slot.id,
    course_code: null,
    course_type: slot.course_type,
    service: slot.course_type,
    subject: slot.subject,
    level: slot.level,
    group_type: 'group',
    session_length_minutes: slot.session_length_minutes,
    price_per_session: null,
    price_per_person_per_60min: slot.price_per_person_per_60min,
    currency: slot.currency || 'CHF',
    location: slot.location,
    location_text: formatPublicLocation(slot),
    first_session_at: null,
    schedule_text: scheduleText,
    weekday: slot.weekday,
    start_time: timeText(slot.start_time),
    end_time: timeText(slot.end_time),
    timezone: slot.timezone || 'Europe/Zurich',
    sessions_completed: 0,
    sessions_remaining: Math.max(0, Number(slot.sessions_total || 0)),
    sessions_total: Math.max(0, Number(slot.sessions_total || 0)),
    spots_remaining: spotsRemaining,
    capacity,
    minimum_students: minimumStudents,
    interested_count: reservedCount,
    allow_reduced_lessons: slot.allow_reduced_lessons === true,
    reduced_lessons_if_one: reducedLessonCount(slot.sessions_total, 1, minimumStudents),
    reduced_lessons_if_two: reducedLessonCount(slot.sessions_total, 2, minimumStudents),
    notes: slot.notes || null,
  };
}

export function isPublicSlotEligible(slot, pendingCount = 0) {
  return slot.public_booking_enabled === true && slot.status === 'active' && pendingCount >= 0;
}

export async function loadPublicCourseCandidates(env, courseId = null) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const nowISO = new Date().toISOString();
  const idFilter = courseId ? `&id=eq.${encodeURIComponent(courseId)}` : '';

  const coursesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/courses?public_booking_enabled=is.true&status=eq.active&group_type=eq.group&location=in.("teacher's home","classroom")${idFilter}&order=course_code.asc&select=id,course_code,course_type,subject,level,group_type,status,sessions_total,sessions_completed,session_length_minutes,price_per_session,price_per_person_per_60min,currency,location,location_company,location_street,location_street_number,location_postal_code,location_city,public_booking_enabled`,
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

export async function loadPublicGroupCourseSlots(env, slotId = null) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const idFilter = slotId ? `&id=eq.${encodeURIComponent(slotId)}` : '';

  const slotsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/public_group_course_slots?public_booking_enabled=is.true&status=eq.active${idFilter}&order=weekday.asc,start_time.asc&select=*`,
    { headers: H }
  );
  if (!slotsRes.ok) {
    const text = await slotsRes.text();
    if (slotsRes.status === 400 || slotsRes.status === 404) {
      console.warn('public group course slots unavailable:', text);
      return [];
    }
    throw new Error(`Could not load public group course slots: ${text}`);
  }

  const slots = await slotsRes.json();
  if (!slots.length) return [];

  const slotIds = slots.map((slot) => slot.id);
  const slotFilter = slotIds.map((id) => `public_group_course_slot_id.eq.${id}`).join(',');
  const pendingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enquiries?or=(${slotFilter})&status=eq.${PUBLIC_SLOT_BOOKING_STATUS}&select=public_group_course_slot_id`,
    { headers: H }
  );
  const pendingBookings = pendingRes.ok ? await pendingRes.json() : [];
  const pendingCountBySlot = {};
  for (const enquiry of pendingBookings) {
    const id = enquiry.public_group_course_slot_id;
    pendingCountBySlot[id] = (pendingCountBySlot[id] || 0) + 1;
  }

  return slots.map((slot) => ({
    ...slot,
    pending_booking_count: pendingCountBySlot[slot.id] || 0,
  }));
}
