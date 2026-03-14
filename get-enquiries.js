// netlify/functions/get-enquiries.js
// GET /api/get-enquiries?status=new&limit=50
// Requires header: x-admin-password matching ADMIN_PASSWORD env var

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD       = process.env.ADMIN_PASSWORD;

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Simple password check
  const pwd = event.headers['x-admin-password'];
  if (!pwd || pwd !== ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  const { status, limit = '100' } = event.queryStringParameters || {};

  let url = `${SUPABASE_URL}/rest/v1/enquiries?order=created_at.desc&limit=${limit}`;
  if (status && status !== 'all') url += `&status=eq.${status}`;

  try {
    const res = await fetch(url, {
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('Fetch error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Connection error' }) };
  }
};
