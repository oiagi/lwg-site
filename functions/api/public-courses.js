// functions/api/public-courses.js
// GET /api/public-courses
//
// Returns only public-safe information for active group courses that have
// direct public booking explicitly enabled and at least one upcoming session.

import { jsonResponse, errorResponse, withErrorHandling, checkRateLimit } from './_utils.js';
import {
  isPublicCourseEligible,
  loadPublicCourseCandidates,
  publicCourseDto,
} from './_public-course-booking.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 30, windowSeconds: 60 });
  if (rateLimitErr) return rateLimitErr;

  try {
    const now = new Date();
    const courses = await loadPublicCourseCandidates(env);
    const out = courses
      .filter((course) => isPublicCourseEligible(course, course.pending_booking_count, now))
      .map((course) => publicCourseDto(course, course.pending_booking_count, now))
      .sort((a, b) => new Date(a.first_session_at) - new Date(b.first_session_at));

    return jsonResponse(out);
  } catch (err) {
    console.error('public-courses error:', err);
    return errorResponse('Could not load courses');
  }
}, 'public-courses');
