// functions/api/intake.js
// GET  /api/intake?token=<access_token>   → returns the student's intake fields
// POST /api/intake                        → updates the student's intake fields
//   body: { token, first_name, last_name, email?, phone?, street?, ... }
//
// The student's access_token acts as the credential — no admin login
// required. The token expires after 90 days, so an admin can revoke a link by
// rotating it.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  checkRateLimit,
  parseJsonBody,
} from './_utils.js';
import { getStudentLanguage } from './_student-utils.js';

const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';
const ADMIN_EMAIL = 'info@learningwithgioia.ch';

const TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const RETURN_FIELDS = [
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
  'billing_gender',
  'billing_gender_note',
  'billing_email',
  'billing_phone',
  'billing_street',
  'billing_street_number',
  'billing_postcode',
  'billing_city',
];
const RETURN_FIELDS_COMPAT = RETURN_FIELDS.filter(
  (field) => !['billing_gender', 'billing_gender_note'].includes(field)
);

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function genderLabel(gender, genderNote, isDE) {
  if (gender === 'female') return isDE ? 'Frau' : 'Ms.';
  if (gender === 'male') return isDE ? 'Herr' : 'Mr.';
  if (gender === 'other' && genderNote) return genderNote;
  return '';
}

function tableRow(label, value) {
  if (!value) return '';
  return `<tr>
    <td style="padding:5px 0;color:#888;font-size:13px;vertical-align:top;white-space:nowrap;">${esc(label)}</td>
    <td style="padding:5px 0 5px 20px;font-size:13px;color:#1a1a1a;">${esc(value)}</td>
  </tr>`;
}

function tableSection(title) {
  return `<tr><td colspan="2" style="padding:16px 0 4px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#aaa;border-top:1px solid #eee;">${esc(title)}</td></tr>`;
}

function buildIntakeConfirmationEmail(data, lang) {
  const isDE = lang === 'de';
  const salutation = genderLabel(data.gender, data.gender_note, isDE);
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ');
  const address = [
    [data.street, data.street_number].filter(Boolean).join(' '),
    [data.postcode, data.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  const hasBilling = !!(data.billing_name || data.billing_street);
  const hasEmergency = !!(
    data.emergency_contact ||
    data.ec_relationship ||
    data.ec_phone ||
    data.ec_email
  );
  const billingAddress = hasBilling
    ? [
        [data.billing_street, data.billing_street_number].filter(Boolean).join(' '),
        [data.billing_postcode, data.billing_city].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const L = isDE
    ? {
        subject: 'Deine Anmeldedaten — learning with gioia',
        greeting: `Hallo ${esc(data.first_name || 'du')} :)`,
        intro:
          'Vielen Dank! Wir haben dein Formular erhalten. Hier ist eine Übersicht der gespeicherten Daten:',
        personal: 'Persönliche Angaben',
        emergency: 'Notfallkontakt',
        billing: 'Rechnungsadresse',
        salutation: 'Anrede',
        name: 'Name',
        email: 'E-Mail',
        phone: 'Telefon',
        address: 'Adresse',
        relationship: 'Beziehung',
        footer:
          'Falls etwas korrigiert werden muss, antworte einfach auf diese E-Mail oder schreib uns an',
      }
    : {
        subject: 'Your enrolment details — learning with gioia',
        greeting: `Hi ${esc(data.first_name || 'there')} :)`,
        intro: "Thank you! We've received your form. Here's a summary of the details we've stored:",
        personal: 'Personal details',
        emergency: 'Emergency contact',
        billing: 'Billing address',
        salutation: 'Salutation',
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        relationship: 'Relationship',
        footer: 'If anything needs correcting, just reply to this email or write to us at',
      };

  const html = `<!DOCTYPE html>
<html lang="${isDE ? 'de' : 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:32px 40px;">
          <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <p style="margin:0 0 16px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">${L.greeting}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#333;">${esc(L.intro)}</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${tableSection(L.personal)}
            ${tableRow(L.salutation, salutation)}
            ${tableRow(L.name, name)}
            ${tableRow(L.email, data.email)}
            ${tableRow(L.phone, data.phone)}
            ${tableRow(L.address, address)}
            ${hasEmergency ? tableSection(L.emergency) : ''}
            ${tableRow(L.name, data.emergency_contact)}
            ${tableRow(L.relationship, data.ec_relationship)}
            ${tableRow(L.phone, data.ec_phone)}
            ${tableRow(L.email, data.ec_email)}
            ${hasBilling ? tableSection(L.billing) : ''}
            ${hasBilling ? tableRow(L.salutation, genderLabel(data.billing_gender, data.billing_gender_note, isDE)) : ''}
            ${hasBilling ? tableRow(L.name, data.billing_name) : ''}
            ${hasBilling ? tableRow(L.email, data.billing_email) : ''}
            ${hasBilling ? tableRow(L.phone, data.billing_phone) : ''}
            ${hasBilling ? tableRow(L.address, billingAddress) : ''}
          </table>
        </td></tr>
        <tr><td style="padding:24px 40px 32px;border-top:1px solid #eee;">
          <p style="margin:0 0 8px;font-size:13px;color:#aaa;line-height:1.6;">
            ${esc(L.footer)}
            <a href="mailto:info@learningwithgioia.ch" style="color:#1a1a1a;">info@learningwithgioia.ch</a>.
          </p>
          <p style="margin:0;font-size:13px;color:#aaa;">
            <a href="https://learningwithgioia.ch" style="color:#aaa;">learningwithgioia.ch</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: L.subject, html };
}

function emailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function missingRequired(body, fields) {
  return fields.find((field) => !body[field]);
}

async function loadStudentByToken(env, token) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const baseUrl = `${SUPABASE_URL}/rest/v1/students?access_token=eq.${encodeURIComponent(token)}`;
  let selectedFields = RETURN_FIELDS;
  let select = ['id', 'token_created_at', 'created_at', ...selectedFields].join(',');
  let res = await fetch(`${baseUrl}&select=${select}`, { headers: H });
  if (!res.ok && res.status === 400) {
    selectedFields = RETURN_FIELDS_COMPAT;
    select = ['id', 'token_created_at', 'created_at', ...selectedFields].join(',');
    res = await fetch(`${baseUrl}&select=${select}`, { headers: H });
  }
  if (!res.ok) return { error: 'Database error', status: 500 };
  const rows = await res.json();
  if (!rows.length) return { error: 'Invalid token', status: 404 };
  const student = rows[0];
  for (const field of RETURN_FIELDS) {
    if (!(field in student)) student[field] = null;
  }

  const tokenDate = student.token_created_at || student.created_at;
  if (tokenDate) {
    const ageMs = Date.now() - new Date(tokenDate).getTime();
    if (ageMs > TOKEN_MAX_AGE_MS) {
      return { error: 'This link has expired. Please contact us for a new one.', status: 410 };
    }
  }
  return { student };
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return errorResponse('Missing token', 400);

  const { student, error, status } = await loadStudentByToken(env, token);
  if (error) return errorResponse(error, status);

  const out = {};
  for (const f of RETURN_FIELDS) out[f] = student[f] ?? null;
  return jsonResponse(out);
}, 'intake-get');

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const { body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const token = body.token;
  if (!token) return errorResponse('Missing token', 400);

  if (!body.first_name || !body.last_name) {
    return errorResponse('First name and last name are required', 400);
  }
  if (!['female', 'male', 'other'].includes(body.gender)) {
    return errorResponse('Salutation is required', 400);
  }
  if (body.gender === 'other' && !body.gender_note) {
    return errorResponse('Please specify your salutation', 400);
  }
  const missing = missingRequired(body, [
    'email',
    'phone',
    'street',
    'street_number',
    'postcode',
    'city',
  ]);
  if (missing) return errorResponse(`${missing} is required`, 400);
  if (!emailValid(body.email)) return errorResponse('email must be valid', 400);
  if (body.ec_email && !emailValid(body.ec_email)) {
    return errorResponse('ec_email must be valid', 400);
  }
  if (body.billing_separate) {
    const missingBilling = missingRequired(body, [
      'billing_name',
      'billing_gender',
      'billing_email',
      'billing_street',
      'billing_street_number',
      'billing_postcode',
      'billing_city',
    ]);
    if (missingBilling) return errorResponse(`${missingBilling} is required`, 400);
    if (!['female', 'male', 'other'].includes(body.billing_gender)) {
      return errorResponse('Billing salutation is required', 400);
    }
    if (body.billing_gender === 'other' && !body.billing_gender_note) {
      return errorResponse('Please specify the billing salutation', 400);
    }
    if (!emailValid(body.billing_email)) return errorResponse('billing_email must be valid', 400);
  }

  const { student, error, status } = await loadStudentByToken(env, token);
  if (error) return errorResponse(error, status);

  const editable = [
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
  ];
  const update = {};
  for (const f of editable) {
    if (f in body) update[f] = body[f];
  }
  if (!['she/her', 'he/him', 'they/them', 'other', 'female', 'male'].includes(update.gender)) {
    update.gender = null;
    update.gender_note = null;
  } else if (update.gender !== 'other') {
    update.gender_note = null;
  }

  const billingFields = [
    'billing_name',
    'billing_gender',
    'billing_gender_note',
    'billing_email',
    'billing_phone',
    'billing_street',
    'billing_street_number',
    'billing_postcode',
    'billing_city',
  ];
  if (body.billing_separate) {
    for (const f of billingFields) {
      if (f in body) update[f] = body[f];
    }
    if (!['female', 'male', 'other'].includes(update.billing_gender)) {
      update.billing_gender = null;
      update.billing_gender_note = null;
    } else if (update.billing_gender !== 'other') {
      update.billing_gender_note = null;
    }
    const streetLine = [update.billing_street, update.billing_street_number]
      .filter(Boolean)
      .join(' ');
    const cityLine = [update.billing_postcode, update.billing_city].filter(Boolean).join(' ');
    const derived = [streetLine, cityLine].filter(Boolean).join(', ');
    update.billing_address = derived || null;
  } else {
    for (const f of billingFields) update[f] = null;
    update.billing_address = null;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${student.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    console.error('Intake save error:', await res.text());
    return errorResponse('Database error');
  }

  // Best-effort: record completion timestamp (requires intake_completed_at column in students table)
  fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${student.id}`, {
    method: 'PATCH',
    headers: H,
    body: JSON.stringify({ intake_completed_at: new Date().toISOString() }),
  }).catch(() => {});

  // Best-effort: notify admin + confirm to student
  if (RESEND_API_KEY) {
    const studentName =
      [update.first_name || student.first_name, update.last_name || student.last_name]
        .filter(Boolean)
        .join(' ') || 'unknown';
    const studentEmail = update.email || student.email || '';

    const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:24px 40px;">
          <p style="margin:0;color:#d6eaf8;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">intake form completed</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
            <tr>
              <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;">Student</td>
              <td style="padding:6px 0 6px 20px;font-size:13px;">${esc(studentName)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#888;font-size:13px;">Email</td>
              <td style="padding:6px 0 6px 20px;font-size:13px;">${esc(studentEmail)}</td>
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
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        reply_to: [ADMIN_EMAIL],
        subject: `Intake form completed — ${studentName}`,
        html: adminHtml,
      }),
    }).catch(() => {});

    if (studentEmail) {
      const lang = await getStudentLanguage(SUPABASE_URL, SUPABASE_SERVICE_KEY, student.id);
      const confirmData = {
        ...update,
        gender: update.gender ?? student.gender,
        gender_note: update.gender_note ?? student.gender_note,
        first_name: update.first_name || student.first_name,
        last_name: update.last_name || student.last_name,
      };
      const { subject, html: confirmHtml } = buildIntakeConfirmationEmail(confirmData, lang);
      const confirmRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [studentEmail],
          reply_to: [ADMIN_EMAIL],
          subject,
          html: confirmHtml,
        }),
      }).catch((err) => {
        console.error('[intake] student confirmation fetch error:', err?.message);
        return null;
      });
      if (confirmRes && !confirmRes.ok) {
        console.error('[intake] student confirmation email failed:', await confirmRes.text());
      }
    }
  }

  return jsonResponse({ success: true });
}, 'intake-post');
