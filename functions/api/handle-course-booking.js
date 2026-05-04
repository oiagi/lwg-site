// functions/api/handle-course-booking.js
// POST /api/handle-course-booking
// Body: { enquiry_id, action: "approve" | "decline" }
//
// Admin handling for direct public course booking enquiries. Approval enrols
// the linked/requesting student into the existing course; decline releases the
// pending reserved spot by moving the enquiry out of pending_course_booking.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { findOrCreateStudent } from './_student-utils.js';
import { PUBLIC_BOOKING_STATUS, PUBLIC_COURSE_CAPACITY } from './_public-course-booking.js';

function cleanString(value, max = 320) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function getLead(enquiry) {
  const lead = enquiry.contact_data?.lead || {};
  const intake = enquiry.contact_data?.intake || {};
  return {
    first_name:
      cleanString(enquiry.lead_first, 200) ||
      cleanString(lead.firstName, 200) ||
      cleanString(intake.first_name, 200),
    last_name:
      cleanString(enquiry.lead_last, 200) ||
      cleanString(lead.lastName, 200) ||
      cleanString(intake.last_name, 200),
    email:
      cleanString(enquiry.lead_email, 320) ||
      cleanString(lead.email, 320) ||
      cleanString(intake.email, 320),
    phone:
      cleanString(enquiry.lead_phone, 200) ||
      cleanString(lead.phone, 200) ||
      cleanString(intake.phone, 200),
  };
}

async function patchEnquiry(SUPABASE_URL, H, enquiryId, fields) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/enquiries?id=eq.${encodeURIComponent(enquiryId)}`,
    {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify(fields),
    }
  );
  if (!res.ok) {
    console.error('handle-course-booking enquiry patch error:', await res.text());
    return null;
  }
  const rows = await res.json();
  return rows[0] || null;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const enquiryId = cleanString(body.enquiry_id, 80);
  const action = body.action === 'approve' || body.action === 'decline' ? body.action : null;
  if (!enquiryId) return errorResponse('Missing enquiry_id', 400);
  if (!action) return errorResponse('Invalid action', 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const enquiryRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enquiries?id=eq.${encodeURIComponent(enquiryId)}&select=*`,
    { headers: H }
  );
  if (!enquiryRes.ok) return errorResponse('Database error');
  const enquiries = await enquiryRes.json();
  const enquiry = enquiries[0];
  if (!enquiry) return errorResponse('Booking enquiry not found', 404);
  if (enquiry.status !== PUBLIC_BOOKING_STATUS) {
    return errorResponse('Booking enquiry is no longer pending', 409);
  }
  if (!enquiry.course_id) return errorResponse('Booking enquiry has no course', 400);

  if (action === 'decline') {
    const updated = await patchEnquiry(SUPABASE_URL, H, enquiryId, { status: 'declined' });
    if (!updated) return errorResponse('Could not decline booking request');
    return jsonResponse({ success: true, status: updated.status });
  }

  const courseId = enquiry.course_id;
  const enrolmentsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${encodeURIComponent(courseId)}&select=student_id`,
    { headers: H }
  );
  if (!enrolmentsRes.ok) return errorResponse('Could not check course enrolments');
  const enrolments = await enrolmentsRes.json();

  let studentId = enquiry.student_id;
  const alreadyEnrolled = studentId && enrolments.some((e) => e.student_id === studentId);
  if (!alreadyEnrolled && enrolments.length >= PUBLIC_COURSE_CAPACITY) {
    return errorResponse('Course is already full', 409);
  }

  if (!studentId) {
    const lead = getLead(enquiry);
    if (!lead.email && !lead.first_name) {
      return errorResponse('Booking enquiry has no student details', 400);
    }
    studentId = await findOrCreateStudent(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      ...lead,
      source: 'website',
    });
  }

  const enrolRes = await fetch(`${SUPABASE_URL}/rest/v1/enrolments`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ student_id: studentId, course_id: courseId }),
  });
  if (!enrolRes.ok) {
    console.error('handle-course-booking enrolment error:', await enrolRes.text());
    return errorResponse('Could not enrol student');
  }

  const updated = await patchEnquiry(SUPABASE_URL, H, enquiryId, {
    status: 'confirmed',
    student_id: studentId,
  });
  if (!updated) return errorResponse('Student enrolled, but enquiry could not be updated');

  return jsonResponse({
    success: true,
    status: updated.status,
    course_id: courseId,
    student_id: studentId,
  });
}, 'handle-course-booking');
