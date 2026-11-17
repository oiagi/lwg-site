// functions/api/_questionnaire-requests.js
// Storage side of asking a student for the pre-course questionnaire, shared by
// the three endpoints that can carry the link: send-questionnaire-request.js
// (on its own), send-invoice.js and send-course-confirmation.js (inside the
// course letter).

import { ROUTES } from '../_i18n-content.js';

// Stands in for a real token when an email is only being previewed and the
// student has no questionnaire row yet. Previews never create rows.
export const PREVIEW_TOKEN = 'preview';

function storageError(message, userMessage) {
  const err = new Error(message);
  err.statusCode = 500;
  err.userMessage = userMessage;
  return err;
}

/**
 * Looks up, and unless `create` is false creates, the course_questionnaires
 * row of every recipient. Existing rows keep their token, so a link already in
 * a student's inbox stays valid.
 *
 * @returns {{ tokensByStudent: Record<string,string>, answered: Set<string> }}
 *   tokens of the students still to be asked, and the ids of those who have
 *   already submitted.
 */
export async function ensureQuestionnaireRows({
  SUPABASE_URL,
  H,
  courseId,
  recipients,
  language,
  create = true,
}) {
  const idFilter = recipients.map((s) => `student_id.eq.${s.id}`).join(',');
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/course_questionnaires?course_id=eq.${encodeURIComponent(courseId)}&or=(${idFilter})&select=student_id,token,submitted_at`,
    { headers: H }
  );
  if (!existingRes.ok) {
    console.error('Could not read course_questionnaires:', await existingRes.text());
    throw storageError(
      'Questionnaire storage unavailable',
      'Questionnaire table not available. Run the add_course_questionnaires migration, or untick the questionnaire.'
    );
  }

  const tokensByStudent = {};
  const answered = new Set();
  for (const row of await existingRes.json()) {
    if (row.submitted_at) answered.add(String(row.student_id));
    else tokensByStudent[String(row.student_id)] = row.token;
  }
  if (!create) return { tokensByStudent, answered };

  const newRows = recipients
    .filter(
      (s) =>
        !answered.has(String(s.id)) &&
        !Object.prototype.hasOwnProperty.call(tokensByStudent, String(s.id))
    )
    .map((s) => ({
      student_id: s.id,
      course_id: courseId,
      token: crypto.randomUUID(),
      language,
    }));

  if (newRows.length) {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/course_questionnaires`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify(newRows),
    });
    if (!insertRes.ok) {
      console.error('Could not create course_questionnaires rows:', await insertRes.text());
      throw storageError(
        'Questionnaire storage failed',
        'Could not create the questionnaire requests.'
      );
    }
    for (const row of await insertRes.json()) {
      tokensByStudent[String(row.student_id)] = row.token;
    }
  }

  return { tokensByStudent, answered };
}

/** The private link a student opens: /<lang>/fragebogen or /<lang>/questionnaire. */
export function questionnaireLink({ env, request, language, token }) {
  const base = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  const slug = ROUTES['/questionnaire.html'][language];
  // ?lang is part of i18n.js's language resolution.
  return `${base}/${language}/${slug}?token=${encodeURIComponent(token)}&lang=${language}`;
}

/**
 * The link for one student inside a course letter, or null when they have
 * already answered. A preview reads only: it shows the student's real link
 * when one exists and a placeholder otherwise.
 */
export async function questionnaireLinkForStudent({
  env,
  request,
  H,
  courseId,
  studentId,
  language,
  preview = false,
}) {
  const { tokensByStudent, answered } = await ensureQuestionnaireRows({
    SUPABASE_URL: env.SUPABASE_URL,
    H,
    courseId,
    recipients: [{ id: studentId }],
    language,
    create: !preview,
  });
  if (answered.has(String(studentId))) return null;
  const token = tokensByStudent[String(studentId)] || (preview ? PREVIEW_TOKEN : null);
  return token ? questionnaireLink({ env, request, language, token }) : null;
}

/** Stamps requested_at once the email carrying the link has gone out. */
export async function markQuestionnaireRequested({
  SUPABASE_URL,
  H,
  courseId,
  studentIds,
  language,
}) {
  if (!studentIds.length) return;
  const idFilter = studentIds.map((id) => `student_id.eq.${id}`).join(',');
  try {
    await fetch(
      `${SUPABASE_URL}/rest/v1/course_questionnaires?course_id=eq.${encodeURIComponent(courseId)}&or=(${idFilter})`,
      {
        method: 'PATCH',
        headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ requested_at: new Date().toISOString(), language }),
      }
    );
  } catch (err) {
    console.error('Failed to record questionnaire requested_at:', err?.message || err);
  }
}
