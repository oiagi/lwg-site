// functions/api/contract-upload.js
// GET  /api/contract-upload?token=<access_token>&contract=<contract_ref>
//   → returns contract status + course info for the public upload page
// POST /api/contract-upload  (multipart/form-data: token, contract, file)
//   → stores the signed contract in the private `contracts` storage bucket
//     and marks the contract row as signed
//
// The student's access_token acts as the credential (same pattern as the
// intake form) — no admin login required. The token expires after 90 days.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY (optional, admin notify)

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  checkRateLimit,
} from './_utils.js';
import { sendResendEmail } from './_email.js';

const ADMIN_EMAIL = 'info@learningwithgioia.ch';

const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Loads the student by token and the contract by ref, verifying that the
// contract belongs to that student and the token is not expired.
async function loadContractByToken(env, token, contractRef) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const stuRes = await fetch(
    `${SUPABASE_URL}/rest/v1/students?access_token=eq.${encodeURIComponent(token)}&select=id,first_name,last_name,email,token_created_at,created_at`,
    { headers: H }
  );
  if (!stuRes.ok) return { error: 'Database error', status: 500 };
  const students = await stuRes.json();
  if (!students.length) return { error: 'Invalid link', status: 404 };
  const student = students[0];

  const tokenDate = student.token_created_at || student.created_at;
  if (tokenDate && Date.now() - new Date(tokenDate).getTime() > TOKEN_MAX_AGE_MS) {
    return { error: 'This link has expired. Please contact us for a new one.', status: 410 };
  }

  const conRes = await fetch(
    `${SUPABASE_URL}/rest/v1/contracts?contract_ref=eq.${encodeURIComponent(contractRef)}&select=id,contract_ref,student_id,course_id,language,sent_at,signed_uploaded_at,signed_file_name`,
    { headers: H }
  );
  if (!conRes.ok) return { error: 'Database error', status: 500 };
  const contracts = await conRes.json();
  const contract = contracts[0];
  if (!contract || contract.student_id !== student.id) {
    return { error: 'Invalid link', status: 404 };
  }

  return { student, contract };
}

async function loadCourseCode(env, courseId) {
  const H = supabaseHeaders(env.SUPABASE_SERVICE_KEY);
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&select=course_code,level,subject`,
    { headers: H }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 20 });
  if (rateLimitErr) return rateLimitErr;

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const contractRef = url.searchParams.get('contract');
  if (!token || !contractRef) return errorResponse('Missing token or contract', 400);

  const { student, contract, error, status } = await loadContractByToken(env, token, contractRef);
  if (error) return errorResponse(error, status);

  const course = await loadCourseCode(env, contract.course_id);

  return jsonResponse({
    contract_ref: contract.contract_ref,
    language: contract.language === 'en' ? 'en' : 'de',
    first_name: student.first_name || '',
    course_code: course?.course_code || '',
    level: course?.level || '',
    subject: course?.subject || '',
    sent_at: contract.sent_at,
    signed_uploaded_at: contract.signed_uploaded_at,
    signed_file_name: contract.signed_file_name,
  });
}, 'contract-upload-get');

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 10 });
  if (rateLimitErr) return rateLimitErr;

  let form;
  try {
    form = await request.formData();
  } catch {
    return errorResponse('Invalid form data', 400);
  }

  const token = form.get('token');
  const contractRef = form.get('contract');
  const file = form.get('file');
  if (typeof token !== 'string' || typeof contractRef !== 'string' || !token || !contractRef) {
    return errorResponse('Missing token or contract', 400);
  }
  if (!file || typeof file === 'string') return errorResponse('Missing file', 400);

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return errorResponse('Only PDF, JPG or PNG files are accepted', 400);
  if (file.size > MAX_FILE_BYTES) return errorResponse('File is too large (max. 10 MB)', 400);
  if (!file.size) return errorResponse('File is empty', 400);

  const { student, contract, error, status } = await loadContractByToken(env, token, contractRef);
  if (error) return errorResponse(error, status);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;

  // Store under a fixed path per contract so a re-upload replaces the
  // previous file instead of accumulating copies.
  const storagePath = `${contract.contract_ref}/signed.${ext}`;
  const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/contracts/${storagePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      apikey: SUPABASE_SERVICE_KEY,
      'Content-Type': file.type,
      'x-upsert': 'true',
    },
    body: await file.arrayBuffer(),
  });
  if (!uploadRes.ok) {
    console.error('Contract storage upload failed:', await uploadRes.text());
    return errorResponse('Upload failed, please try again', 502);
  }

  const uploadedAt = new Date().toISOString();
  const originalName = String(file.name || `signed.${ext}`).slice(0, 200);
  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/contracts?id=eq.${encodeURIComponent(contract.id)}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
      body: JSON.stringify({
        signed_uploaded_at: uploadedAt,
        signed_file_path: storagePath,
        signed_file_name: originalName,
        signed_content_type: file.type,
        signed_file_size: file.size,
      }),
    }
  );
  if (!patchRes.ok) {
    console.error('Contract record update failed:', await patchRes.text());
    return errorResponse('Upload failed, please try again', 502);
  }

  // Best-effort: notify admin
  if (RESEND_API_KEY) {
    const studentName =
      [student.first_name, student.last_name].filter(Boolean).join(' ') ||
      student.email ||
      'unknown';
    const course = await loadCourseCode(env, contract.course_id);
    const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:24px 40px;">
          <p style="margin:0;color:#d6eaf8;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">signed contract uploaded</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
            <tr>
              <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;">Student</td>
              <td style="padding:6px 0 6px 20px;font-size:13px;">${esc(studentName)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#888;font-size:13px;">Course</td>
              <td style="padding:6px 0 6px 20px;font-size:13px;">${esc(course?.course_code || contract.course_id)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#888;font-size:13px;">Contract</td>
              <td style="padding:6px 0 6px 20px;font-size:13px;">${esc(contract.contract_ref)}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 40px 28px;border-top:1px solid #eee;">
          <a href="https://learningwithgioia.ch/admin/" style="font-size:12px;color:#888;">View in admin dashboard →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    await sendResendEmail(RESEND_API_KEY, {
      to: [ADMIN_EMAIL],
      reply_to: [ADMIN_EMAIL],
      subject: `Signed contract uploaded — ${studentName}`,
      html: adminHtml,
    }).catch(() => {});
  }

  return jsonResponse({ success: true, signed_uploaded_at: uploadedAt });
}, 'contract-upload-post');
