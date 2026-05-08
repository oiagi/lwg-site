// functions/api/delete-student.js
// DELETE /api/delete-student?id=<uuid>
//
// Deletes a student and all records that reference them (attendance,
// enrolments, enquiries, invoices), then removes the student itself.
// The frontend confirms the destructive action before calling.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';
const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];

// Tables that reference students.id via student_id. Ordered so that any
// FK constraints with ON DELETE RESTRICT won't block the final delete.
const RELATED_TABLES = ['attendance', 'enrolments', 'enquiries', 'invoices'];

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildGdprDeletionEmail(student) {
  const name = [student.first_name, student.last_name].filter(Boolean).join(' ') || 'there';
  return {
    subject: 'Data deletion confirmed — Datenlöschung bestätigt · learning with gioia',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:32px 40px;">
          <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">Hi ${esc(name)}</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">We have received your data deletion request and have deleted your personal data from our records.</p>
          <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#555;border-top:1px solid #eee;padding-top:18px;">Wir haben Ihre Anfrage zur Datenlöschung erhalten und Ihre personenbezogenen Daten aus unseren Unterlagen gelöscht.</p>
          <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
            Questions? Write to <a href="mailto:info@learningwithgioia.ch" style="color:#1a1a1a;">info@learningwithgioia.ch</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 40px 28px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:13px;color:#aaa;">
            <a href="https://learningwithgioia.ch" style="color:#aaa;">learningwithgioia.ch</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

export const onRequestDelete = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('Missing id', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  // Fetch student before deletion so we can send the GDPR confirmation email
  let studentEmail = null;
  let studentRecord = null;
  try {
    const stuRes = await fetch(
      `${SUPABASE_URL}/rest/v1/students?id=eq.${encodeURIComponent(id)}&select=first_name,last_name,email`,
      { headers: H }
    );
    if (stuRes.ok) {
      const rows = await stuRes.json();
      studentRecord = rows[0] || null;
      studentEmail = studentRecord?.email || null;
    }
  } catch (err) {
    console.error('delete-student: could not fetch student for email (non-fatal):', err);
  }

  for (const table of RELATED_TABLES) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?student_id=eq.${id}`, {
      method: 'DELETE',
      headers: H,
    });
    if (!res.ok) {
      console.error(`Failed to delete related ${table}:`, await res.text());
      return errorResponse(`Could not delete student's ${table}`);
    }
  }

  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${id}`, {
    method: 'DELETE',
    headers: H,
  });

  if (!delRes.ok) {
    console.error('Delete student error:', await delRes.text());
    return errorResponse('Database error');
  }

  if (RESEND_API_KEY && studentEmail && studentRecord) {
    const email = buildGdprDeletionEmail(studentRecord);
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [studentEmail],
        reply_to: NOTIFY_EMAILS,
        subject: email.subject,
        html: email.html,
      }),
    })
      .then((r) => {
        if (!r.ok) r.text().then((t) => console.error('delete-student email error:', t));
      })
      .catch((err) => console.error('delete-student email error (non-fatal):', err));
  }

  return jsonResponse({ success: true });
}, 'delete-student');
