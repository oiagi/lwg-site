// functions/submit-enquiry.js
// POST /api/submit-enquiry
// Body: { booking: {...}, contact: {...} }
//
// Environment variables (set in Cloudflare Pages → Settings → Environment variables):
//   SUPABASE_URL         — Supabase project URL
//   SUPABASE_SERVICE_KEY — service_role key
//   RESEND_API_KEY       — Resend API key

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  validateOrigin,
  checkRateLimit,
  withErrorHandling,
  parseJsonBody,
  normalizePageLanguage,
} from './_utils.js';
import { validate } from './_validate.js';
import { findOrCreateStudent, getOrCreateIntakeToken } from './_student-utils.js';

const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];
const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Label map for booking fields ─────────────────────────────────────────
function label(key, language = 'en') {
  if (language === 'de') {
    return key === 'lessonType' ? 'Gewünschter Unterricht' : key;
  }
  return key === 'lessonType' ? "What they're looking for" : key;
}

// ── Format booking object into display lines ──────────────────────────────
function formatBooking(b, language = 'en') {
  const lines = [];
  for (const [k, v] of Object.entries(b)) {
    if (k === 'language') continue;
    const val = Array.isArray(v) ? v.join(', ') : v;
    if (val) lines.push(`${label(k, language)}: ${val}`);
  }
  return lines;
}

function formatPreferredContact(value, language = 'en') {
  if (language !== 'de') return value;
  return { Email: 'E-Mail', Phone: 'Telefon', Either: 'E-Mail oder Telefon' }[value] || value;
}

// ── Customer confirmation email ───────────────────────────────────────────
function buildCustomerEmail(booking, contact, language = 'en', intakeUrl = null) {
  const isGerman = language === 'de';
  const lead = contact.lead || contact;
  const name = lead.firstName || (isGerman ? 'du' : 'there');
  const bookingLines = formatBooking(booking, language);
  const copy = isGerman
    ? {
        subject: 'Wir haben deine Anfrage erhalten — learning with gioia',
        htmlLang: 'de',
        thankYou: `Danke, ${esc(name)} :)`,
        body: 'Wir haben deine Nachricht erhalten und melden uns in Kürze bei dir, um deine Anfrage zu besprechen.',
        intakeText:
          'In der Zwischenzeit füll bitte dieses Formular aus. Ohne diese Angaben können wir dich nicht in einen Kurs einschreiben!',
        intakeBtn: 'Formular ausfüllen →',
        enquiryLabel: 'Deine Anfrage',
        preferredContact: 'Bevorzugte Kontaktart',
        footer:
          'Wenn du in der Zwischenzeit Fragen hast, antworte auf diese E-Mail oder schreib an',
      }
    : {
        subject: "We've received your enquiry — learning with gioia",
        htmlLang: 'en',
        thankYou: `Thank you, ${esc(name)} :)`,
        body: "We've received your message and will contact you shortly to discuss your enquiry.",
        intakeText:
          'In the meantime, please complete this form. Without this information we cannot enrol you in a course!',
        intakeBtn: 'Complete the form →',
        enquiryLabel: 'Your enquiry',
        preferredContact: 'Preferred contact',
        footer: 'If you have any questions in the meantime, reply to this email or write to',
      };

  const bookingRows = bookingLines
    .map((line) => {
      const [k, ...rest] = line.split(': ');
      return `<tr>
      <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;">${esc(k)}</td>
      <td style="padding:6px 0 6px 24px;font-size:13px;">${esc(rest.join(': '))}</td>
    </tr>`;
    })
    .join('');

  const preferredContactRow = contact.preferredContact
    ? `<tr><td style="padding:6px 0;color:#888;font-size:13px;">${copy.preferredContact}</td>
       <td style="padding:6px 0 6px 24px;font-size:13px;">${esc(formatPreferredContact(contact.preferredContact, language))}</td></tr>`
    : '';

  const intakeSection = intakeUrl
    ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#333;">${esc(copy.intakeText)}</p>
       <p style="margin:0 0 32px;">
         <a href="${esc(intakeUrl)}" style="display:inline-block;background:#1a1a1a;color:#d6eaf8;text-decoration:none;padding:10px 14px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">${copy.intakeBtn}</a>
       </p>`
    : '';

  return {
    subject: copy.subject,
    html: `<!DOCTYPE html>
<html lang="${copy.htmlLang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr>
          <td style="background:#1a1a1a;padding:32px 40px;">
            <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">
              ${copy.thankYou}
            </p>
            <p style="margin:0 0 ${intakeUrl ? '24px' : '32px'};font-size:15px;line-height:1.7;color:#333;">
              ${esc(copy.body)}
            </p>
            ${intakeSection}
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">${copy.enquiryLabel}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
              ${bookingRows}
              ${preferredContactRow}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
              ${esc(copy.footer)}
              <a href="mailto:info@learningwithgioia.ch" style="color:#1a1a1a;">info@learningwithgioia.ch</a>.
            </p>
            <p style="margin:16px 0 0;font-size:13px;color:#aaa;">
              <a href="https://learningwithgioia.ch" style="color:#aaa;">learningwithgioia.ch</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

// ── Internal notification email to gioia ─────────────────────────────────
function buildNotificationEmail(booking, contact, enquiryId) {
  const lead = contact.lead || contact;
  const bookingLines = formatBooking(booking);

  const rows = [
    ['ID', enquiryId],
    ['Lead', `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '—'],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Preferred contact', contact.preferredContact || '—'],
    ...bookingLines.map((l) => {
      const [k, ...r] = l.split(': ');
      return [k, r.join(': ')];
    }),
  ];

  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr>
       <td style="padding:5px 0;color:#888;font-size:13px;vertical-align:top;white-space:nowrap;">${k}</td>
       <td style="padding:5px 0 5px 20px;font-size:13px;">${v || '—'}</td>
     </tr>`
    )
    .join('');

  return {
    subject: `New enquiry — ${lead.firstName || ''} ${lead.lastName || ''} (${
      (booking.lessonType || '')
        .replace(/[\r\n]+/g, ' ')
        .trim()
        .slice(0, 50) || 'no details'
    })`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr>
          <td style="background:#1a1a1a;padding:24px 40px;">
            <p style="margin:0;color:#d6eaf8;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">new enquiry</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
              ${tableRows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 28px;border-top:1px solid #eee;">
            <a href="https://learningwithgioia.ch/admin.html" style="font-size:12px;color:#888;">View in admin dashboard →</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

// ── Main handler (Cloudflare Pages Functions format) ─────────────────────
export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const originErr = validateOrigin(request, env);
  if (originErr) return originErr;

  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY } = env;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  let { booking } = body;
  const { contact } = body;
  const language = normalizePageLanguage(body.language);
  if (!booking || !contact) {
    return errorResponse('Missing booking or contact data', 400);
  }

  const bookingErr = validate(booking, {
    lessonType: { required: true, type: 'string', maxLength: 3000 },
  });
  if (bookingErr) return errorResponse(bookingErr, 400);

  // ── Whitelist booking to only the expected fields ─────────────────────
  // Rebuild explicitly so extra client-supplied keys never reach formatBooking()
  // or get persisted in booking_data.
  booking = { lessonType: booking.lessonType.replace(/\s+/g, ' ').trim(), language };
  const contactWithLanguage = { ...contact, language };

  const lead = contact.lead || contact;

  const leadErr = validate(lead, {
    firstName: { required: true, type: 'string', maxLength: 200 },
    email: { required: true, type: 'string', email: true, maxLength: 320 },
  });
  if (leadErr) return errorResponse(leadErr, 400);

  // ── 1. Write to Supabase ───────────────────────────────────────────────
  let enquiryId;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/enquiries`, {
      method: 'POST',
      headers: { ...supabaseHeaders(SUPABASE_SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify({
        service: null,
        lead_first: lead.firstName || null,
        lead_last: lead.lastName || null,
        lead_email: lead.email || null,
        lead_phone: lead.phone || null,
        booking_data: booking,
        contact_data: contactWithLanguage,
        status: 'new',
      }),
    });

    if (!res.ok) {
      console.error('Supabase error:', await res.text());
      return errorResponse('Database error');
    }

    const rows = await res.json();
    enquiryId = rows[0]?.id || 'unknown';
  } catch (err) {
    console.error('Supabase fetch error:', err);
    return errorResponse('Database connection error');
  }

  // ── 2. Link student to enquiry + get intake token (best-effort) ──────
  // Enquiry is already persisted above. If student find/create or the
  // patch fails, we log and continue — the enquiry is not lost.
  let intakeFormUrl = null;
  if (enquiryId !== 'unknown') {
    try {
      const studentId = await findOrCreateStudent(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        first_name: lead.firstName || null,
        last_name: lead.lastName || null,
        email: lead.email || null,
        phone: lead.phone || null,
        source: 'website',
      });
      await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${enquiryId}`, {
        method: 'PATCH',
        headers: supabaseHeaders(SUPABASE_SERVICE_KEY),
        body: JSON.stringify({ student_id: studentId }),
      });
      const token = await getOrCreateIntakeToken(SUPABASE_URL, SUPABASE_SERVICE_KEY, studentId);
      if (token) {
        const base = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
        intakeFormUrl = `${base}/intake.html?token=${encodeURIComponent(token)}`;
      }
    } catch (err) {
      console.error('Student link error (non-fatal):', err);
    }
  }

  // ── 3. Send emails via Resend ──────────────────────────────────────────
  // Both emails are sent concurrently. Email failure does not fail the
  // request — data is already safely stored in Supabase.
  const customerEmail = buildCustomerEmail(booking, contactWithLanguage, language, intakeFormUrl);
  const notificationEmail = buildNotificationEmail(booking, contactWithLanguage, enquiryId);

  const sendEmail = async (to, email) => {
    const toList = Array.isArray(to) ? to : [to];
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: toList,
        reply_to: NOTIFY_EMAILS,
        subject: email.subject,
        html: email.html,
      }),
    });
    if (!res.ok) console.error(`Email error (to: ${toList.join(', ')}):`, await res.text());
    return res.ok;
  };

  await Promise.allSettled([
    sendEmail(lead.email, customerEmail),
    sendEmail(NOTIFY_EMAILS, notificationEmail),
  ]);

  return jsonResponse({ success: true, id: enquiryId });
}, 'submit-enquiry');
