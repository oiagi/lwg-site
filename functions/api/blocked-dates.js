// functions/api/blocked-dates.js
// Admin CRUD for globally blocked scheduling dates.
//
// GET    — list all blocked periods
// POST   — create one: { start_date, end_date?, label? } (end_date defaults
//          to start_date for single-day blocks)
// DELETE — remove one: { id }
//
// Blocked periods are applied when scheduling recurring courses
// (confirm-booking) and enforced on running courses during sync-calendar.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';

function normalizeDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const cleaned = value.trim();
  const date = new Date(cleaned + 'T00:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== cleaned) return null;
  return cleaned;
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/blocked_dates?select=id,start_date,end_date,label&order=start_date.asc`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  if (!res.ok) {
    console.error('blocked-dates load error:', await res.text());
    return errorResponse('Could not load blocked dates');
  }
  return jsonResponse(await res.json());
}, 'blocked-dates');

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const startDate = normalizeDate(body.start_date);
  const endDate = body.end_date ? normalizeDate(body.end_date) : startDate;
  if (!startDate) return errorResponse('start_date must be a valid YYYY-MM-DD date', 400);
  if (!endDate) return errorResponse('end_date must be a valid YYYY-MM-DD date', 400);
  if (endDate < startDate) return errorResponse('end_date cannot be before start_date', 400);

  const label = body.label ? String(body.label).replace(/\s+/g, ' ').trim().slice(0, 120) : null;

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/blocked_dates`, {
    method: 'POST',
    headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
    body: JSON.stringify({ start_date: startDate, end_date: endDate, label }),
  });
  if (!res.ok) {
    console.error('blocked-dates create error:', await res.text());
    return errorResponse('Could not create blocked period');
  }
  const rows = await res.json();
  return jsonResponse(rows[0]);
}, 'blocked-dates');

export const onRequestDelete = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return errorResponse('Missing id', 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/blocked_dates?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
  });
  if (!res.ok) {
    console.error('blocked-dates delete error:', await res.text());
    return errorResponse('Could not delete blocked period');
  }
  return jsonResponse({ deleted: true });
}, 'blocked-dates');
