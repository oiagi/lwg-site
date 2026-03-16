// functions/api/update-student.js
// PATCH /api/update-student
// Body: { student_id, progress_notes?, current_level? }
//
// Updates a student's progress notes and/or current level.
// Called from the admin dashboard courses tab.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

export async function onRequestPatch({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD } = env;

  const pwd = request.headers.get('x-admin-password');
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let student_id, progress_notes, current_level;
  try {
    ({ student_id, progress_notes, current_level } = await request.json());
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!student_id) {
    return new Response(JSON.stringify({ error: 'Missing student_id' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const patch = {};
  if (progress_notes !== undefined) patch.progress_notes = progress_notes;
  if (current_level  !== undefined) patch.current_level  = current_level;

  if (!Object.keys(patch).length) {
    return new Response(JSON.stringify({ error: 'Nothing to update' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/students?id=eq.${student_id}`,
      {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer':        'return=representation',
        },
        body: JSON.stringify(patch),
      }
    );

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const rows = await res.json();
    return new Response(JSON.stringify(rows[0] || {}), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Connection error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
