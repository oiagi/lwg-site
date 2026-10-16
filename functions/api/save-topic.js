// functions/api/save-topic.js
// POST /api/save-topic
// Body: { id?, kind?: 'grammar'|'vocabulary', name?, archived? }
//
// Without `id` creates a tag (kind and name required). With `id` renames,
// re-kinds or (un)archives it. Tags are never deleted: lessons reference
// them, so an unwanted tag is archived instead.
//
// Names are unique per kind, case-insensitively (topics_kind_name_key);
// a clash returns 409.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
} from './_utils.js';
import { validate } from './_validate.js';

export const TOPIC_KINDS = ['grammar', 'vocabulary'];
export const TOPIC_NAME_MAX = 120;

const SCHEMA = {
  id: { type: 'string' },
  kind: { type: 'string', oneOf: TOPIC_KINDS },
  name: { type: 'string', maxLength: TOPIC_NAME_MAX },
  archived: { type: 'boolean' },
};

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const err = validate(body, SCHEMA);
  if (err) return errorResponse(err, 400);

  const data = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim().replace(/\s+/g, ' ');
    if (!name) return errorResponse('name must not be empty', 400);
    data.name = name;
  }
  if (body.kind !== undefined) data.kind = body.kind;
  if (body.archived !== undefined) data.archived = body.archived;

  if (!body.id && (!data.name || !data.kind)) {
    return errorResponse('kind and name are required', 400);
  }
  if (body.id && !Object.keys(data).length) {
    return errorResponse('Nothing to update', 400);
  }

  const H = { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' };
  const res = body.id
    ? await fetch(`${SUPABASE_URL}/rest/v1/topics?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify(data),
      })
    : await fetch(`${SUPABASE_URL}/rest/v1/topics`, {
        method: 'POST',
        headers: H,
        body: JSON.stringify(data),
      });

  if (res.status === 409) return errorResponse('Tag existiert bereits', 409);
  if (!res.ok) {
    console.error('save-topic error:', await res.text());
    return errorResponse('Database error');
  }
  const rows = await res.json();
  if (!rows.length) return errorResponse('Topic not found', 404);
  return jsonResponse(rows[0]);
}, 'save-topic');
