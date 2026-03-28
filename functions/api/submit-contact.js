// functions/api/submit-contact.js
// POST /api/submit-contact
// Proxies the contact form to Web3Forms, keeping the API key server-side.
//
// Environment variables:
//   WEB3FORMS_ACCESS_KEY — Web3Forms access key

import { jsonResponse, errorResponse, validateOrigin, checkRateLimit } from './_utils.js';

export async function onRequestPost({ request, env }) {
  const originErr = validateOrigin(request, env);
  if (originErr) return originErr;

  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const { name, email, phone, preferred_contact, message } = body;
  if (!name || !email || !message) {
    return errorResponse('Name, email, and message are required', 400);
  }

  const accessKey = env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) {
    console.error('WEB3FORMS_ACCESS_KEY not configured');
    return errorResponse('Server configuration error', 500);
  }

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: accessKey,
        name,
        email,
        phone: phone || '',
        preferred_contact: preferred_contact || '',
        message,
      }),
    });

    if (!res.ok) {
      console.error('Web3Forms error:', await res.text());
      return errorResponse('Could not send message', 502);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error('Web3Forms fetch error:', err?.message || err);
    return errorResponse('Could not send message', 502);
  }
}
