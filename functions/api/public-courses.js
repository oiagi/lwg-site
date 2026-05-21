// functions/api/public-courses.js
// GET /api/public-courses
//
// Returns public-safe information for active public group courses and
// forming course slots that can receive direct booking requests.

import { jsonResponse, errorResponse, withErrorHandling, checkRateLimit } from './_utils.js';
import {
  isPublicCourseEligible,
  isPublicSlotEligible,
  loadPublicCourseCandidates,
  loadPublicGroupCourseSlots,
  publicCourseDto,
  publicSlotDto,
} from './_public-course-booking.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 30, windowSeconds: 60 });
  if (rateLimitErr) return rateLimitErr;

  try {
    const now = new Date();
    const [courses, slots] = await Promise.all([
      loadPublicCourseCandidates(env),
      loadPublicGroupCourseSlots(env),
    ]);
    const courseDtos = courses
      .filter((course) => isPublicCourseEligible(course, course.pending_booking_count, now))
      .map((course) => publicCourseDto(course, course.pending_booking_count, now));
    const slotDtos = slots
      .filter((slot) => isPublicSlotEligible(slot, slot.pending_booking_count))
      .map((slot) => publicSlotDto(slot, slot.pending_booking_count));
    const out = [...courseDtos, ...slotDtos].sort((a, b) => {
      if (a.first_session_at && b.first_session_at) {
        return new Date(a.first_session_at) - new Date(b.first_session_at);
      }
      if (a.first_session_at) return -1;
      if (b.first_session_at) return 1;
      return (
        (a.weekday || 0) - (b.weekday || 0) ||
        (a.start_time || '').localeCompare(b.start_time || '')
      );
    });

    return jsonResponse(out);
  } catch (err) {
    console.error('public-courses error:', err);
    return errorResponse('Could not load courses');
  }
}, 'public-courses');
