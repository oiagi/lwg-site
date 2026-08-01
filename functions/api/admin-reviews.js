// functions/api/admin-reviews.js
// GET    /api/admin-reviews — all reviews, newest first (admin).
// PATCH  /api/admin-reviews — update approved / translation / name / text.
// DELETE /api/admin-reviews — delete a review.

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  requireAdminAuth,
  withErrorHandling,
  parseJsonBody,
  pickDefined,
  hasFields,
} from './_utils.js';
import { validate } from './_validate.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/reviews?select=*&order=created_at.desc`, {
    headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
  });
  if (!res.ok) {
    console.error('Supabase error:', await res.text());
    return errorResponse('Could not load reviews');
  }
  return jsonResponse(await res.json());
}, 'admin-reviews-get');

export const onRequestPatch = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const validationErr = validate(body, {
    id: { required: true, type: 'string', maxLength: 64 },
    approved: { type: 'boolean' },
    name: { type: 'string', maxLength: 200 },
    text: { type: 'string', maxLength: 3000 },
    translation: { type: 'string', maxLength: 3000 },
  });
  if (validationErr) return errorResponse(validationErr, 400);

  const patch = pickDefined(body, ['approved', 'name', 'text', 'translation']);
  if (!hasFields(patch)) return errorResponse('Nothing to update', 400);
  if (patch.translation === '') patch.translation = null;
  if (patch.approved !== undefined) {
    patch.approved_at = patch.approved ? new Date().toISOString() : null;
  }

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/reviews?id=eq.${encodeURIComponent(body.id)}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(env.SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    }
  );
  if (!res.ok) {
    console.error('Supabase error:', await res.text());
    return errorResponse('Could not update review');
  }
  const rows = await res.json();
  if (!rows.length) return errorResponse('Review not found', 404);
  return jsonResponse(rows[0]);
}, 'admin-reviews-patch');

export const onRequestDelete = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;
  if (!body.id || typeof body.id !== 'string') return errorResponse('id is required', 400);

  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/reviews?id=eq.${encodeURIComponent(body.id)}`,
    { method: 'DELETE', headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    console.error('Supabase error:', await res.text());
    return errorResponse('Could not delete review');
  }
  return jsonResponse({ success: true });
}, 'admin-reviews-delete');
