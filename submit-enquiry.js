// netlify/functions/submit-enquiry.js
// POST /api/submit-enquiry
// Body: { booking: {...}, contact: {...} }
//
// Environment variables required (set in Netlify UI → Site → Environment variables):
//   SUPABASE_URL         — https://eedxxgbsxnuxarwiommo.supabase.co
//   SUPABASE_SERVICE_KEY — your service_role key
//   RESEND_API_KEY       — your Resend API key

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY;

const NOTIFY_EMAIL = 'info@oiagi.org';   // gioia notification recipient
const FROM_EMAIL   = 'learning with gioia <hello@oiagi.org>';

// ── Helpers ─────────────────────────────────────────────────────────────

function label(key) {
  const map = {
    language:    'Language',
    background:  'Background',
    level:       'Course level',
    exam:        'Exam',
    examDate:    'Exam date',
    frequency:   'Frequency',
    format:      'Format',
    location:    'Location',
    group:       'Group size',
    grades:      'School year',
    subjects:    'Subjects',
  };
  return map[key] || key;
}

function formatBooking(b) {
  const svc = b.service === 'tutoring' ? 'Tutoring'
            : b.service === 'exam prep' ? 'Exam preparation'
            : 'Language course';
  const lines = [`Service: ${svc}`];
  for (const [k, v] of Object.entries(b)) {
    if (k === 'service') continue;
    const val = Array.isArray(v) ? v.join(', ') : v;
    if (val) lines.push(`${label(k)}: ${val}`);
  }
  return lines;
}

function formatDays(days) {
  return Array.isArray(days) ? days.join(', ') : days || '—';
}

function formatTimeOfDay(tod) {
  return Array.isArray(tod) ? tod.join(', ') : tod || '—';
}

function participantLines(participants) {
  if (!participants || participants.length === 0) return ['—'];
  return participants.map((p, i) => {
    const parts = [p.firstName, p.lastName].filter(Boolean).join(' ');
    const contact = [p.email, p.phone].filter(Boolean).join(' · ');
    return `${i + 1}. ${parts}${contact ? ' — ' + contact : ''}`;
  });
}

// ── Email builders ───────────────────────────────────────────────────────

function buildCustomerEmail(booking, contact) {
  const name = contact.lead.firstName;
  const bookingLines = formatBooking(booking);

  const participantsSection = contact.participants && contact.participants.length > 0
    ? `<tr><td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;">Participants</td>
       <td style="padding:6px 0 6px 24px;font-size:13px;">${participantLines(contact.participants).join('<br>')}</td></tr>`
    : '';

  const ageRangeRow = contact.ageRange
    ? `<tr><td style="padding:6px 0;color:#888;font-size:13px;">Age range</td>
       <td style="padding:6px 0 6px 24px;font-size:13px;">${contact.ageRange}</td></tr>`
    : '';

  const notesRow = contact.notes
    ? `<tr><td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;">Notes</td>
       <td style="padding:6px 0 6px 24px;font-size:13px;">${contact.notes}</td></tr>`
    : '';

  const bookingRows = bookingLines.map(line => {
    const [k, ...rest] = line.split(': ');
    return `<tr>
      <td style="padding:6px 0;color:#888;font-size:13px;vertical-align:top;">${k}</td>
      <td style="padding:6px 0 6px 24px;font-size:13px;">${rest.join(': ')}</td>
    </tr>`;
  }).join('');

  return {
    subject: 'We\'ve received your enquiry — learning with gioia',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1a1a1a;padding:32px 40px;">
            <p style="margin:0;color:#d6eaf8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">
              Thank you, ${name}.
            </p>
            <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:#333;">
              We've received your enquiry and will be in touch within 48 hours to confirm your booking.
              We personally review every enquiry to make sure we match you with the right teacher.
            </p>

            <!-- Booking summary -->
            <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">Your enquiry</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
              ${bookingRows}
              <tr><td colspan="2" style="padding:12px 0 0;border-top:1px solid #eee;"></td></tr>
              <tr><td style="padding:6px 0;color:#888;font-size:13px;">For</td>
                  <td style="padding:6px 0 6px 24px;font-size:13px;">${contact.ageGroup}</td></tr>
              ${ageRangeRow}
              ${participantsSection}
              <tr><td style="padding:6px 0;color:#888;font-size:13px;">Available days</td>
                  <td style="padding:6px 0 6px 24px;font-size:13px;">${formatDays(contact.days)}</td></tr>
              <tr><td style="padding:6px 0;color:#888;font-size:13px;">Time of day</td>
                  <td style="padding:6px 0 6px 24px;font-size:13px;">${formatTimeOfDay(contact.timeOfDay)}</td></tr>
              ${notesRow}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
              If you have any questions in the meantime, reply to this email or write to
              <a href="mailto:info@oiagi.org" style="color:#1a1a1a;">info@oiagi.org</a>.
            </p>
            <p style="margin:16px 0 0;font-size:13px;color:#aaa;">
              <a href="https://oiagi.org" style="color:#aaa;">oiagi.org</a>
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

function buildNotificationEmail(booking, contact, enquiryId) {
  const lead = contact.lead;
  const bookingLines = formatBooking(booking);

  const rows = [
    ['ID', enquiryId],
    ['Lead', `${lead.firstName} ${lead.lastName}`],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Self-participant', lead.selfParticipant ? 'Yes' : 'No'],
    ['For', contact.ageGroup + (contact.ageRange ? ` (${contact.ageRange})` : '')],
    ...bookingLines.map(l => { const [k, ...r] = l.split(': '); return [k, r.join(': ')]; }),
    ['Available days', formatDays(contact.days)],
    ['Time of day', formatTimeOfDay(contact.timeOfDay)],
    ...(contact.notes ? [['Scheduling notes', contact.notes]] : []),
  ];

  const tableRows = rows.map(([k, v]) =>
    `<tr><td style="padding:5px 0;color:#888;font-size:13px;vertical-align:top;white-space:nowrap;">${k}</td>
         <td style="padding:5px 0 5px 20px;font-size:13px;">${v || '—'}</td></tr>`
  ).join('');

  const participantBlock = contact.participants && contact.participants.length > 0
    ? `<p style="margin:24px 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#aaa;">Participants</p>
       <table width="100%" cellpadding="0" cellspacing="0">
         ${contact.participants.map((p, i) => `
           <tr><td colspan="2" style="padding:8px 0 4px;font-size:12px;color:#555;border-top:1px solid #f0f0f0;">
             Participant ${i + 1}
           </td></tr>
           <tr><td style="padding:3px 0;color:#888;font-size:13px;">Name</td>
               <td style="padding:3px 0 3px 20px;font-size:13px;">${[p.firstName, p.lastName].filter(Boolean).join(' ') || '—'}</td></tr>
           <tr><td style="padding:3px 0;color:#888;font-size:13px;">Email</td>
               <td style="padding:3px 0 3px 20px;font-size:13px;">${p.email || '—'}</td></tr>
           <tr><td style="padding:3px 0;color:#888;font-size:13px;">Phone</td>
               <td style="padding:3px 0 3px 20px;font-size:13px;">${p.phone || '—'}</td></tr>
           <tr><td style="padding:3px 0;color:#888;font-size:13px;">Postcode</td>
               <td style="padding:3px 0 3px 20px;font-size:13px;">${p.postcode || '—'}</td></tr>
         `).join('')}
       </table>`
    : '';

  return {
    subject: `New enquiry — ${lead.firstName} ${lead.lastName} (${booking.service || 'unknown'})`,
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
            ${participantBlock}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 28px;border-top:1px solid #eee;">
            <a href="https://oiagi.org/admin.html" style="font-size:12px;color:#888;">View in admin dashboard →</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

// ── Main handler ─────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let booking, contact;
  try {
    ({ booking, contact } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!booking || !contact || !contact.lead) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing booking or contact data' }) };
  }

  // ── 1. Write to Supabase ─────────────────────────────────────────────
  let enquiryId;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/enquiries`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer':        'return=representation',
      },
      body: JSON.stringify({
        service:      booking.service || null,
        lead_first:   contact.lead.firstName || null,
        lead_last:    contact.lead.lastName  || null,
        lead_email:   contact.lead.email     || null,
        lead_phone:   contact.lead.phone     || null,
        booking_data: booking,
        contact_data: contact,
        status:       'new',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) };
    }

    const rows = await res.json();
    enquiryId = rows[0]?.id || 'unknown';
  } catch (err) {
    console.error('Supabase fetch error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Database connection error' }) };
  }

  // ── 2. Send emails via Resend ────────────────────────────────────────
  const customerEmail     = buildCustomerEmail(booking, contact);
  const notificationEmail = buildNotificationEmail(booking, contact, enquiryId);

  const sendEmail = async (to, email) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:     FROM_EMAIL,
        to:       [to],
        reply_to: NOTIFY_EMAIL,
        subject:  email.subject,
        html:     email.html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`Email send error (to: ${to}):`, err);
    }
    return res.ok;
  };

  // Send both emails — don't fail the whole request if email fails
  // (data is safely in Supabase already)
  await Promise.allSettled([
    sendEmail(contact.lead.email, customerEmail),
    sendEmail(NOTIFY_EMAIL, notificationEmail),
  ]);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, id: enquiryId }),
  };
};
