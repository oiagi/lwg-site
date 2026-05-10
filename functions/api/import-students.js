// functions/api/import-students.js
// POST /api/import-students
// Body: { rows: [{ first_name, last_name, email, phone, ... }, ...] }
//
// Dedup rule: if `email` matches an existing student, PATCH that row;
// otherwise INSERT a new student (status defaults to 'active'). Rows
// without a first_name are skipped.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';

const ALLOWED_FIELDS = [
  'first_name',
  'last_name',
  'gender',
  'gender_note',
  'email',
  'phone',
  'street',
  'street_number',
  'postcode',
  'city',
  'emergency_contact',
  'ec_relationship',
  'ec_phone',
  'ec_email',
  'billing_name',
  'billing_email',
  'billing_phone',
  'billing_street',
  'billing_street_number',
  'billing_postcode',
  'billing_city',
  'vat_number',
  'payment_method',
  'progress_notes',
  'status',
];

const VALID_STATUS = new Set(['active', 'inactive', 'prospect']);

function pickAllowed(row) {
  const out = {};
  for (const f of ALLOWED_FIELDS) {
    const v = row[f];
    if (v !== undefined && v !== null && v !== '') {
      out[f] = typeof v === 'string' ? v.trim() : v;
    }
  }
  if (out.status && !VALID_STATUS.has(out.status)) delete out.status;
  return out;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const { rows } = body;
  if (!Array.isArray(rows) || !rows.length) {
    return errorResponse('rows must be a non-empty array', 400);
  }
  if (rows.length > 2000) {
    return errorResponse('Too many rows in one import (max 2000)', 400);
  }

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const headersWithRepr = { ...H, Prefer: 'return=representation' };

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const src = rows[i] || {};
    const data = pickAllowed(src);
    if (!data.first_name) {
      skipped++;
      continue;
    }

    try {
      // Email-based dedup. Missing email always inserts a new row.
      let existingId = null;
      if (data.email) {
        const lookup = await fetch(
          `${SUPABASE_URL}/rest/v1/students?email=eq.${encodeURIComponent(data.email)}&select=id`,
          { headers: H }
        );
        const hit = lookup.ok ? await lookup.json() : [];
        if (Array.isArray(hit) && hit.length) existingId = hit[0].id;
      }

      if (existingId) {
        // Keep active in sync with status for dual-write compat.
        const patch = { ...data };
        if (patch.status) patch.active = patch.status === 'active';
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/students?id=eq.${encodeURIComponent(existingId)}`,
          { method: 'PATCH', headers: H, body: JSON.stringify(patch) }
        );
        if (res.ok) updated++;
        else {
          skipped++;
          errors.push({ row: i + 1, error: await res.text() });
        }
      } else {
        const insert = { ...data };
        if (!insert.status) {
          insert.status = 'active';
          insert.active = true;
        } else {
          insert.active = insert.status === 'active';
        }
        if (!insert.source) insert.source = 'import';
        insert.access_token = crypto.randomUUID();
        insert.token_created_at = new Date().toISOString();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/students`, {
          method: 'POST',
          headers: headersWithRepr,
          body: JSON.stringify(insert),
        });
        if (res.ok) created++;
        else {
          skipped++;
          errors.push({ row: i + 1, error: await res.text() });
        }
      }
    } catch (err) {
      skipped++;
      errors.push({ row: i + 1, error: String(err.message || err) });
    }
  }

  return jsonResponse({ created, updated, skipped, errors: errors.slice(0, 20) });
}, 'import-students');
