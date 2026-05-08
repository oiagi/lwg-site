// functions/api/_student-utils.js
// Shared student helpers: email-first dedup/create and status management.
// Used by confirm-booking, submit-enquiry, and any future endpoint that
// needs to find or create a student record.

import { supabaseHeaders } from './_utils.js';

/**
 * Find an existing student by email or create a new one.
 * New students are created with status='prospect' and active=false.
 * Returns the student id.
 */
export async function findOrCreateStudent(
  supabaseUrl,
  serviceKey,
  { first_name, last_name, email, phone, postcode, source }
) {
  const H = supabaseHeaders(serviceKey);

  if (email) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/students?email=eq.${encodeURIComponent(email)}&select=id`,
      { headers: H }
    );
    const existing = await res.json();
    if (existing.length) return existing[0].id;
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/students`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify({
      first_name: first_name || null,
      last_name: last_name || null,
      email: email || null,
      phone: phone || null,
      postcode: postcode || null,
      source,
      status: 'prospect',
      active: false,
    }),
  });
  if (!res.ok) throw new Error(`Student creation failed: ${await res.text()}`);
  const rows = await res.json();
  return rows[0].id;
}

/**
 * Update a student's status and keep the active boolean in sync.
 * Dual-write compat: any code still reading students.active will see correct value.
 */
export async function setStudentStatus(supabaseUrl, serviceKey, studentId, status) {
  const H = supabaseHeaders(serviceKey);
  await fetch(`${supabaseUrl}/rest/v1/students?id=eq.${studentId}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ status, active: status === 'active' }),
  });
}

async function patchStudentEnquiries(supabaseUrl, H, filter, fields) {
  const res = await fetch(`${supabaseUrl}/rest/v1/enquiries?${filter}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    console.error('Enquiry completion failed:', await res.text());
    return 0;
  }
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows.length : 0;
}

/**
 * Once a student is enrolled, their regular enquiry flags should leave the
 * untreated queue. Public group-booking requests are only completed when the
 * enrolment is for that exact requested course.
 */
export async function completeEnquiriesForEnrollment(supabaseUrl, serviceKey, studentId, courseId) {
  if (!studentId || !courseId) return 0;
  const H = supabaseHeaders(serviceKey);
  const encodedStudentId = encodeURIComponent(studentId);
  const encodedCourseId = encodeURIComponent(courseId);
  let completed = 0;

  completed += await patchStudentEnquiries(
    supabaseUrl,
    H,
    `student_id=eq.${encodedStudentId}&status=eq.new`,
    { status: 'confirmed', course_id: courseId }
  );

  completed += await patchStudentEnquiries(
    supabaseUrl,
    H,
    `student_id=eq.${encodedStudentId}&status=eq.pending_course_booking&course_id=eq.${encodedCourseId}`,
    { status: 'confirmed' }
  );

  return completed;
}
