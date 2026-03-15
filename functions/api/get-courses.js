// functions/api/get-courses.js
// GET /api/get-courses?status=active
//
// Returns courses with their session counts and participant details.
// Used by the admin dashboard courses tab.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

export async function onRequestGet({ request, env }) {
  const SUPABASE_URL         = env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
  const ADMIN_PASSWORD       = env.ADMIN_PASSWORD;

  // ── Password check ───────────────────────────────────────────────────
  const pwd = request.headers.get('x-admin-password');
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url    = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';

  let supabaseUrl = `${SUPABASE_URL}/rest/v1/courses?order=created_at.desc&select=*`;
  if (status !== 'all') supabaseUrl += `&status=eq.${status}`;

  try {
    const res = await fetch(supabaseUrl, {
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    const courses = await res.json();

    // ── Fetch sessions for each course ─────────────────────────────────
    // Attach sessions array to each course so the dashboard can show
    // the full schedule without a separate API call per course.
    const enriched = await Promise.all(courses.map(async (course) => {
      const sessRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?course_id=eq.${course.id}&order=scheduled_at.asc&select=*`,
        {
          headers: {
            'apikey':        SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      const sessions = sessRes.ok ? await sessRes.json() : [];
      return { ...course, sessions };
    }));

    return new Response(JSON.stringify(enriched), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Connection error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
