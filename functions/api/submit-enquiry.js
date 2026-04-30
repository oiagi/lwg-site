// functions/submit-enquiry.js
// POST /api/submit-enquiry
// Body: { booking: {...}, contact: {...} }
//
// Environment variables (set in Cloudflare Pages → Settings → Environment variables):
//   SUPABASE_URL         — https://eedxxgbsxnuxarwiommo.supabase.co
//   SUPABASE_SERVICE_KEY — service_role key
//   RESEND_API_KEY       — Resend API key

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  validateOrigin,
  checkRateLimit,
  withErrorHandling,
} from './_utils.js';
import { validate } from './_validate.js';
import { findOrCreateStudent } from './_student-utils.js';

const NOTIFY_EMAILS = ['info@oiagi.org', 'info@learningwithgioia.ch'];
const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';

// ── Label map for booking fields ─────────────────────────────────────────
function label(key) {
  return key === 'lessonType' ? "What they're looking for" : key;
}

// ── Format booking object into display lines ──────────────────────────────
function formatBooking(b) {
  const lines = [];
  for (const [k, v] of Object.entries(b)) {
    const val = Array.isArray(v) ? v.join(', ') : v;
    if (val) lines.push(`${label(k)}: ${val}`);
  }
  return lines;
}

// ── Customer confirmation email ───────────────────────────────────────────
function buildCustomerEmail(booking, contact) {
  const lead = contact.lead || contact;
  const name = lead.firstName || 'there';
  const bookingLines = formatBooking(booking);

  const bookingRows = bookingLines
    .map((line) => {
      const [k, ...rest] = line.split(': ');
      return `<tr>
      <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;">${k}</td>
      <td style="padding:6px 0 6px 24px;font-size:13px;">${rest.join(': ')}</td>
    </tr>`;
    })
    .join('');

  const preferredContactRow = contact.preferredContact
    ? `<tr><td style="padding:6px 0;color:#888;font-size:13px;">Preferred contact</td>
       <td style="padding:6px 0 6px 24px;font-size:13px;">${contact.preferredContact}</td></tr>`
    : '';

  return {
    subject: "We've received your enquiry — learning with gioia",
    html: `<!DOCTYPE html>
<html lang="en">
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
              Thank you, ${name}.
            </p>
            <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#333;">
              We've received your enquiry and will be in touch within 48 hours to confirm your booking.
              We personally review every enquiry to make sure we match you with the right teacher.
            </p>
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">Your enquiry</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
              ${bookingRows}
              ${preferredContactRow}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
              If you have any questions in the meantime, reply to this email or write to
              <a href="mailto:info@oiagi.org" style="color:#1a1a1a;">info@oiagi.org</a>.
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
            <a href="https://learningwithgioia.ch/admin/students" style="font-size:12px;color:#888;">View in admin dashboard →</a>
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

  // Parse request body
  let booking, contact;
  try {
    ({ booking, contact } = await request.json());
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!booking || !contact) {
    return errorResponse('Missing booking or contact data', 400);
  }

  const bookingErr = validate(booking, {
    lessonType: { required: true, type: 'string', maxLength: 3000 },
  });
  if (bookingErr) return errorResponse(bookingErr, 400);

  // ── Whitelist booking to only the expected field ──────────────────────
  // Rebuild explicitly so extra client-supplied keys never reach formatBooking()
  // or get persisted in booking_data.
  booking = { lessonType: booking.lessonType.replace(/\s+/g, ' ').trim() };

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
        contact_data: contact,
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

  // ── 2. Link student to enquiry (best-effort, non-blocking) ───────────
  // Enquiry is already persisted above. If student find/create or the
  // patch fails, we log and continue — the enquiry is not lost.
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
    } catch (err) {
      console.error('Student link error (non-fatal):', err);
    }
  }

  // ── 3. Send emails via Resend ──────────────────────────────────────────
  // Both emails are sent concurrently. Email failure does not fail the
  // request — data is already safely stored in Supabase.
  const customerEmail = buildCustomerEmail(booking, contact);
  const notificationEmail = buildNotificationEmail(booking, contact, enquiryId);

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
