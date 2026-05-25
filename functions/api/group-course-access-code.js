// functions/api/group-course-access-code.js
// POST /api/group-course-access-code
//
// Validates a company/group course access code and returns only the matching
// protected group course slot and existing-course options.

import {
  jsonResponse,
  errorResponse,
  validateOrigin,
  checkRateLimit,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import {
  isCompanyCodeCourseEligible,
  isPublicSlotEligible,
  loadCompanyCodeCourseCandidates,
  loadPublicGroupCourseSlots,
  normalizeAccessCode,
  publicCourseDto,
  publicSlotDto,
} from './_public-course-booking.js';

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const originErr = validateOrigin(request, env);
  if (originErr) return originErr;

  const rateLimitErr = await checkRateLimit(request, { maxRequests: 8, windowSeconds: 60 });
  if (rateLimitErr) return rateLimitErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const accessCode = normalizeAccessCode(body.code || body.access_code);
  if (!accessCode) return errorResponse('Access code is required', 400);

  const [slots, courses] = await Promise.all([
    loadPublicGroupCourseSlots(env, null, { accessCode }),
    loadCompanyCodeCourseCandidates(env, accessCode),
  ]);
  const now = new Date();
  const courseDtos = courses
    .filter((course) => isCompanyCodeCourseEligible(course, course.pending_booking_count, now))
    .map((course) => publicCourseDto(course, course.pending_booking_count, now));
  const slotDtos = slots
    .filter((slot) => isPublicSlotEligible(slot, slot.pending_booking_count))
    .map((slot) => publicSlotDto(slot, slot.pending_booking_count));
  const courseOptions = [...courseDtos, ...slotDtos].sort((a, b) => {
    if (a.first_session_at && b.first_session_at) {
      return new Date(a.first_session_at) - new Date(b.first_session_at);
    }
    if (a.first_session_at) return -1;
    if (b.first_session_at) return 1;
    return (
      (a.weekday || 0) - (b.weekday || 0) || (a.start_time || '').localeCompare(b.start_time || '')
    );
  });

  if (!courseOptions.length) {
    return errorResponse('No group booking options were found for this code.', 404);
  }

  return jsonResponse({
    access_code: accessCode,
    access_label: courseOptions.find((course) => course.access_label)?.access_label || null,
    courses: courseOptions,
  });
}, 'group-course-access-code');
