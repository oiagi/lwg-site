// functions/api/company-intake.js
// GET  /api/company-intake?code=<company_intake_code>  -> company intake metadata
// POST /api/company-intake                             -> create/update student for company
//
// Public endpoint. The company intake code acts as the credential.

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  checkRateLimit,
  parseJsonBody,
  capitalizeNameFields,
} from './_utils.js';
import { sendResendEmail } from './_email.js';

const ADMIN_EMAIL = 'info@learningwithgioia.ch';

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

const RETURN_COMPANY_FIELDS = 'id,name,intake_code';
const STUDENT_RETURN_FIELDS =
  'id,first_name,last_name,email,phone,company_id,source,status,intake_completed_at';

function emailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function missingRequired(body, fields) {
  return fields.find((field) => !body[field]);
}

function normalizeGender(data, field = 'gender', noteField = 'gender_note') {
  if (!['female', 'male', 'other'].includes(data[field])) {
    data[field] = null;
    data[noteField] = null;
  } else if (data[field] !== 'other') {
    data[noteField] = null;
  }
}

function buildBillingAddress(data) {
  const streetLine = [data.billing_street, data.billing_street_number].filter(Boolean).join(' ');
  const cityLine = [data.billing_postcode, data.billing_city].filter(Boolean).join(' ');
  return [streetLine, cityLine].filter(Boolean).join(', ');
}

async function loadCompanyByCode(env, code) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/companies?intake_code=eq.${encodeURIComponent(code)}&select=${RETURN_COMPANY_FIELDS}`,
    { headers: H }
  );
  if (!res.ok) {
    console.error('Company intake lookup error:', await res.text());
    return { error: 'Database error', status: 500 };
  }
  const rows = await res.json();
  if (!rows.length) return { error: 'Invalid company intake link', status: 404 };
  return { company: rows[0] };
}

function buildStudentPayload(body, companyId) {
  const data = {
    first_name: body.first_name,
    last_name: body.last_name,
    gender: body.gender,
    gender_note: body.gender_note || null,
    email: body.email,
    phone: body.phone,
    street: body.street,
    street_number: body.street_number,
    postcode: body.postcode,
    city: body.city,
    emergency_contact: body.emergency_contact,
    ec_relationship: body.ec_relationship,
    ec_phone: body.ec_phone,
    ec_email: body.ec_email,
    company_id: companyId,
    intake_completed_at: new Date().toISOString(),
  };

  normalizeGender(data);

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
    for (const field of billingFields) data[field] = body[field] || null;
    normalizeGender(data, 'billing_gender', 'billing_gender_note');
    data.billing_address = buildBillingAddress(data) || null;
  } else {
    for (const field of billingFields) data[field] = null;
    data.billing_address = null;
  }

  return data;
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 20 });
  if (rateLimitErr) return rateLimitErr;

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return errorResponse('Missing company intake code', 400);

  const { company, error, status } = await loadCompanyByCode(env, code);
  if (error) return errorResponse(error, status);

  return jsonResponse({ company_name: company.name });
}, 'company-intake-get');

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const rateLimitErr = await checkRateLimit(request, { maxRequests: 10 });
  if (rateLimitErr) return rateLimitErr;

  const { body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const code = body.company_code;
  if (!code) return errorResponse('Missing company intake code', 400);

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

  const { company, error, status } = await loadCompanyByCode(env, code);
  if (error) return errorResponse(error, status);

  // Capitalize before building the payload so derived billing_address also
  // gets the formal-case values.
  capitalizeNameFields(body);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;
  const H = { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' };
  const data = buildStudentPayload(body, company.id);

  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/students?email=eq.${encodeURIComponent(body.email)}&select=id`,
    { headers: supabaseHeaders(SUPABASE_SERVICE_KEY) }
  );
  if (!existingRes.ok) {
    console.error('Company intake student lookup error:', await existingRes.text());
    return errorResponse('Database error');
  }
  const existing = await existingRes.json();

  let res;
  if (existing.length) {
    res = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify(data),
    });
  } else {
    res = await fetch(`${SUPABASE_URL}/rest/v1/students?select=${STUDENT_RETURN_FIELDS}`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        ...data,
        source: 'company_intake',
        status: 'prospect',
        active: false,
        access_token: crypto.randomUUID(),
        token_created_at: new Date().toISOString(),
      }),
    });
  }

  if (!res.ok) {
    console.error('Company intake save error:', await res.text());
    return errorResponse('Database error');
  }

  const rows = await res.json();

  // Best-effort: notify admin of new company intake submission
  if (RESEND_API_KEY) {
    const studentName = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'unknown';
    const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:24px 40px;">
          <p style="margin:0;color:#d6eaf8;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">company intake form completed</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
            <tr>
              <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;">Student</td>
              <td style="padding:6px 0 6px 20px;font-size:13px;">${esc(studentName)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#888;font-size:13px;">Email</td>
              <td style="padding:6px 0 6px 20px;font-size:13px;">${esc(body.email)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#888;font-size:13px;">Company</td>
              <td style="padding:6px 0 6px 20px;font-size:13px;">${esc(company.name)}</td>
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
      subject: `Company intake form completed — ${studentName} (${company.name})`,
      html: adminHtml,
    }).catch(() => {});
  }

  // Best-effort: send confirmation to student
  if (RESEND_API_KEY && body.email) {
    const lang = body.language === 'en' ? 'en' : 'de';
    const { subject, html } = buildIntakeConfirmationEmail(data, lang);
    const confirmRes = await sendResendEmail(RESEND_API_KEY, {
      to: [body.email],
      reply_to: [ADMIN_EMAIL],
      subject,
      html,
    }).catch((err) => {
      console.error('[company-intake] confirmation fetch error:', err?.message);
      return null;
    });
    if (confirmRes && !confirmRes.ok) {
      console.error('[company-intake] confirmation email failed:', await confirmRes.text());
    }
  }

  return jsonResponse({ student: rows[0] || null, company_name: company.name });
}, 'company-intake-post');
