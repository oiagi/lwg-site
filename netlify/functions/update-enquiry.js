// netlify/functions/update-enquiry.js
// PATCH /api/update-enquiry
// Body: { id, status?, notes? }
// Requires header: x-admin-password matching ADMIN_PASSWORD env var

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD       = process.env.ADMIN_PASSWORD;

exports.handler = async (event) => {
  if (event.httpMethod !== 'PATCH') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const pwd = event.headers['x-admin-password'];
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  let id, status, notes;
  try {
    ({ id, status, notes } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };
  }

  const patch = {};
  if (status !== undefined) patch.status = status;
  if (notes  !== undefined) patch.notes  = notes;

  if (Object.keys(patch).length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Nothing to update' }) };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer':        'return=representation',
      },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) };
    }

    const rows = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows[0] || {}),
    };
  } catch (err) {
    console.error('Fetch error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Connection error' }) };
  }
};
