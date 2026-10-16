// functions/api/save-attendance.js
// POST /api/save-attendance
// Body: {
//   session_id,
//   records: [
//     { student_id, present: true/false, mode?: 'in_person'|'online',
//       portion?: 'full'|'half', notes? },
//     ...
//   ],
//   topic_ids?: [topic uuid, ...],
//   materials?: [{ material_id, chapter?, pages? }, ...],
//   notes?: string
// }
//
// Upserts attendance records for a session. Each record maps a student to
// present/absent, how they attended (in person or online) and how much of
// the lesson (full or half). Re-submitting corrects the existing records
// through the (session_id, student_id) unique index.
//
// The optional keys log what was taught. When a key is present, the stored
// list is replaced with it (an empty array clears it); when it is absent the
// stored data is left untouched. Notes are written with the completion patch.
//
// This is the only place a session becomes `completed`: the calendar sync
// never decides that by date. When every record saves, the session is
// marked completed and the parent course's completed-session count is
// incremented once.
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

export const ATTENDANCE_MODES = ['in_person', 'online'];
export const ATTENDANCE_PORTIONS = ['full', 'half'];

const BODY_SCHEMA = {
  session_id: { required: true, type: 'string' },
  records: { required: true, type: 'array' },
};

const RECORD_SCHEMA = {
  student_id: { required: true, type: 'string' },
  present: { type: 'boolean' },
  mode: { type: 'string', oneOf: ATTENDANCE_MODES },
  portion: { type: 'string', oneOf: ATTENDANCE_PORTIONS },
  notes: { type: 'string', maxLength: 2000 },
};

export const MAX_SESSION_TOPICS = 30;
export const MAX_SESSION_MATERIALS = 20;

const CRM_SCHEMA = {
  topic_ids: { type: 'array' },
  materials: { type: 'array' },
  notes: { type: 'string', maxLength: 5000 },
};

const MATERIAL_REF_SCHEMA = {
  material_id: { required: true, type: 'string' },
  chapter: { type: 'string', maxLength: 100 },
  pages: { type: 'string', maxLength: 100 },
};

// Validates the optional lesson-content keys. Returns { error } or the
// normalised { topicIds, materials, notes } (undefined = leave untouched).
export function parseSessionCrm(body) {
  const err = validate(body, CRM_SCHEMA);
  if (err) return { error: err };

  let topicIds;
  if (body.topic_ids !== undefined && body.topic_ids !== null) {
    if (body.topic_ids.some((id) => typeof id !== 'string' || !id)) {
      return { error: 'topic_ids must contain strings' };
    }
    topicIds = [...new Set(body.topic_ids)];
    if (topicIds.length > MAX_SESSION_TOPICS) {
      return { error: `topic_ids: at most ${MAX_SESSION_TOPICS}` };
    }
  }

  let materials;
  if (body.materials !== undefined && body.materials !== null) {
    if (body.materials.length > MAX_SESSION_MATERIALS) {
      return { error: `materials: at most ${MAX_SESSION_MATERIALS}` };
    }
    materials = [];
    for (const ref of body.materials) {
      if (!ref || typeof ref !== 'object') return { error: 'materials must contain objects' };
      const refErr = validate(ref, MATERIAL_REF_SCHEMA);
      if (refErr) return { error: `materials: ${refErr}` };
      materials.push({
        material_id: ref.material_id,
        chapter: ref.chapter?.trim() || null,
        pages: ref.pages?.trim() || null,
      });
    }
  }

  const notes = body.notes === undefined ? undefined : String(body.notes ?? '').trim() || null;
  return { topicIds, materials, notes };
}

// Replace-all write for one join table: delete the session's rows, then
// insert the new list. Returns an error label or null.
async function replaceSessionRows(env, table, sessionId, rows) {
  const H = supabaseHeaders(env.SUPABASE_SERVICE_KEY);
  const sid = encodeURIComponent(sessionId);
  const delRes = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?session_id=eq.${sid}`, {
    method: 'DELETE',
    headers: H,
  });
  if (!delRes.ok) {
    console.error(`${table} delete error:`, await delRes.text());
    return 'Database error';
  }
  if (!rows.length) return null;
  const insRes = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify(rows),
  });
  if (!insRes.ok) {
    console.error(`${table} insert error:`, await insRes.text());
    return 'Database error';
  }
  return null;
}

// Mode and portion describe how a student attended, so an absent student
// always carries the defaults regardless of what the client sent.
export function normaliseRecord(sessionId, rec) {
  const present = rec.present !== false;
  const data = {
    session_id: sessionId,
    student_id: rec.student_id,
    present,
    mode: present ? rec.mode || 'in_person' : 'in_person',
    portion: present ? rec.portion || 'full' : 'full',
  };
  if (rec.notes !== undefined) data.notes = rec.notes;
  return data;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const bodyErr = validate(body, BODY_SCHEMA);
  if (bodyErr) return errorResponse(bodyErr, 400);
  const { session_id, records } = body;
  if (!records.length) return errorResponse('records must not be empty', 400);
  for (const rec of records) {
    const recErr = validate(rec, RECORD_SCHEMA);
    if (recErr) return errorResponse(`records: ${recErr}`, 400);
  }
  const crm = parseSessionCrm(body);
  if (crm.error) return errorResponse(crm.error, 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  // ── Verify session exists ────────────────────────────────────────────
  const sessRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?id=eq.${encodeURIComponent(session_id)}&select=id,course_id,status`,
    { headers: H }
  );
  const sessions = await sessRes.json();
  if (!sessions.length) return errorResponse('Session not found', 404);
  const session = sessions[0];

  // ── Upsert attendance records ─────────────────────────────────────────
  const saved = [];
  const errors = [];

  for (const rec of records) {
    const data = normaliseRecord(session_id, rec);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/attendance?on_conflict=session_id,student_id`,
        {
          method: 'POST',
          headers: {
            ...H,
            Prefer: 'return=representation,resolution=merge-duplicates',
          },
          body: JSON.stringify(data),
        }
      );

      if (res.ok) {
        const rows = await res.json();
        saved.push(rows[0]);
      } else {
        console.error('Attendance upsert error:', await res.text());
        errors.push({ student_id: rec.student_id, error: 'Database error' });
      }
    } catch (err) {
      console.error('Attendance error:', err);
      errors.push({ student_id: rec.student_id, error: 'Connection error' });
    }
  }

  // ── Lesson content (topics, materials) ───────────────────────────────
  if (!errors.length && crm.topicIds) {
    const topicErr = await replaceSessionRows(
      env,
      'session_topics',
      session_id,
      crm.topicIds.map((topic_id) => ({ session_id, topic_id }))
    );
    if (topicErr) errors.push({ field: 'topic_ids', error: topicErr });
  }
  if (!errors.length && crm.materials) {
    const materialErr = await replaceSessionRows(
      env,
      'session_materials',
      session_id,
      crm.materials.map((ref, position) => ({ session_id, ...ref, position }))
    );
    if (materialErr) errors.push({ field: 'materials', error: materialErr });
  }

  let completedSession = null;
  let newlyCompleted = false;

  if (!errors.length) {
    const sessionPatch = { status: 'completed' };
    if (crm.notes !== undefined) sessionPatch.notes = crm.notes;
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?id=eq.${encodeURIComponent(session_id)}`,
      {
        method: 'PATCH',
        headers: { ...H, Prefer: 'return=representation' },
        body: JSON.stringify(sessionPatch),
      }
    );

    if (!updateRes.ok) {
      console.error('Session completion error:', await updateRes.text());
      return errorResponse('Attendance saved, but session completion failed');
    }

    const updated = await updateRes.json();
    completedSession = updated[0] || null;
    newlyCompleted = session.status !== 'completed';

    if (newlyCompleted) {
      try {
        const courseRes = await fetch(
          `${SUPABASE_URL}/rest/v1/courses?id=eq.${encodeURIComponent(session.course_id)}&select=sessions_completed`,
          { headers: H }
        );
        const courses = await courseRes.json();
        if (courses.length) {
          const newCount = (courses[0].sessions_completed || 0) + 1;
          await fetch(
            `${SUPABASE_URL}/rest/v1/courses?id=eq.${encodeURIComponent(session.course_id)}`,
            {
              method: 'PATCH',
              headers: H,
              body: JSON.stringify({ sessions_completed: newCount }),
            }
          );
        }
      } catch (err) {
        console.error('Course count update error:', err);
      }
    }
  }

  return jsonResponse({
    success: true,
    saved_count: saved.length,
    records: saved,
    session: completedSession,
    newly_completed: newlyCompleted,
    errors: errors.length ? errors : undefined,
  });
}, 'save-attendance');
