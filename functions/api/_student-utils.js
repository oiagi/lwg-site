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
