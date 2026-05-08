// functions/api/handle-course-booking.js
// POST /api/handle-course-booking
// Body: { enquiry_id, action: "approve" | "decline" }
//
// Admin handling for direct public course booking enquiries. Approval enrols
// the linked/requesting student into the existing course; decline releases the
// pending reserved spot by moving the enquiry out of pending_course_booking.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
  parseJsonBody,
  normalizePageLanguage,
} from './_utils.js';
import { findOrCreateStudent, setStudentStatus } from './_student-utils.js';

const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';
const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildDeclineEmail(enquiry, language) {
  const isDE = language === 'de';
  const name = cleanString(enquiry.lead_first, 200) || (isDE ? 'du' : 'there');
  const copy = isDE
    ? {
        subject: 'Bezüglich deiner Buchungsanfrage — learning with gioia',
        greeting: `Hallo ${esc(name)} :)`,
        body: 'Vielen Dank für deine Anfrage. Leider war jemand schneller und der Kurs, den du angefragt hast, ist leider nicht mehr verfügbar :(',
        closing: 'Wir melden uns bald bei dir, um Optionen zu besprechen.',
        footer: 'Bei Fragen antworte einfach auf diese E-Mail oder schreib an',
      }
    : {
        subject: 'Regarding your booking request — learning with gioia',
        greeting: `Hi ${esc(name)} :)`,
        body: 'Thank you for your request. Unfortunately, somebody was faster and the course you requested is no longer available :(',
        closing: 'We will be in touch shortly to discuss options.',
        footer: 'If you have any questions, reply to this email or write to',
      };

  return {
    subject: copy.subject,
    html: `<!DOCTYPE html>
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
          <p style="margin:0 0 24px;font-size:22px;font-weight:normal;color:#1a1a1a;font-family:Georgia,serif;">${copy.greeting}</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#333;">${esc(copy.body)}</p>
          <p style="margin:0 0 0;font-size:15px;line-height:1.7;color:#333;">${esc(copy.closing)}</p>
        </td></tr>
        <tr><td style="padding:24px 40px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:13px;color:#aaa;line-height:1.6;">
            ${esc(copy.footer)}
            <a href="mailto:info@learningwithgioia.ch" style="color:#1a1a1a;">info@learningwithgioia.ch</a>.
          </p>
          <p style="margin:16px 0 0;font-size:13px;color:#aaa;">
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

async function sendEmail(env, to, email) {
  if (!env.RESEND_API_KEY) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      reply_to: NOTIFY_EMAILS,
      subject: email.subject,
      html: email.html,
    }),
  });
  if (!res.ok) console.error('handle-course-booking email error:', await res.text());
}
import { PUBLIC_BOOKING_STATUS, PUBLIC_COURSE_CAPACITY } from './_public-course-booking.js';

function cleanString(value, max = 320) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function getLead(enquiry) {
  const lead = enquiry.contact_data?.lead || {};
  const intake = enquiry.contact_data?.intake || {};
  return {
    first_name:
      cleanString(enquiry.lead_first, 200) ||
      cleanString(lead.firstName, 200) ||
      cleanString(intake.first_name, 200),
    last_name:
      cleanString(enquiry.lead_last, 200) ||
      cleanString(lead.lastName, 200) ||
      cleanString(intake.last_name, 200),
    gender: cleanString(lead.gender, 20) || cleanString(intake.gender, 20),
    gender_note: cleanString(lead.genderNote, 200) || cleanString(intake.gender_note, 200),
    email:
      cleanString(enquiry.lead_email, 320) ||
      cleanString(lead.email, 320) ||
      cleanString(intake.email, 320),
    phone:
      cleanString(enquiry.lead_phone, 200) ||
      cleanString(lead.phone, 200) ||
      cleanString(intake.phone, 200),
  };
}

async function patchEnquiry(SUPABASE_URL, H, enquiryId, fields) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/enquiries?id=eq.${encodeURIComponent(enquiryId)}`,
    {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify(fields),
    }
  );
  if (!res.ok) {
    console.error('handle-course-booking enquiry patch error:', await res.text());
    return null;
  }
  const rows = await res.json();
  return rows[0] || null;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const enquiryId = cleanString(body.enquiry_id, 80);
  const action = body.action === 'approve' || body.action === 'decline' ? body.action : null;
  if (!enquiryId) return errorResponse('Missing enquiry_id', 400);
  if (!action) return errorResponse('Invalid action', 400);

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  const enquiryRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enquiries?id=eq.${encodeURIComponent(enquiryId)}&select=*`,
    { headers: H }
  );
  if (!enquiryRes.ok) return errorResponse('Database error');
  const enquiries = await enquiryRes.json();
  const enquiry = enquiries[0];
  if (!enquiry) return errorResponse('Booking enquiry not found', 404);
  if (enquiry.status !== PUBLIC_BOOKING_STATUS) {
    return errorResponse('Booking enquiry is no longer pending', 409);
  }
  if (!enquiry.course_id) return errorResponse('Booking enquiry has no course', 400);

  if (action === 'decline') {
    const updated = await patchEnquiry(SUPABASE_URL, H, enquiryId, { status: 'declined' });
    if (!updated) return errorResponse('Could not decline booking request');

    const recipientEmail = cleanString(enquiry.lead_email, 320);
    if (env.RESEND_API_KEY && recipientEmail) {
      const language = normalizePageLanguage(enquiry.contact_data?.language);
      sendEmail(env, recipientEmail, buildDeclineEmail(enquiry, language)).catch((err) =>
        console.error('handle-course-booking decline email error:', err)
      );
    }

    return jsonResponse({ success: true, status: updated.status });
  }

  const courseId = enquiry.course_id;
  const enrolmentsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/enrolments?course_id=eq.${encodeURIComponent(courseId)}&select=student_id`,
    { headers: H }
  );
  if (!enrolmentsRes.ok) return errorResponse('Could not check course enrolments');
  const enrolments = await enrolmentsRes.json();

  let studentId = enquiry.student_id;
  const alreadyEnrolled = studentId && enrolments.some((e) => e.student_id === studentId);
  if (!alreadyEnrolled && enrolments.length >= PUBLIC_COURSE_CAPACITY) {
    return errorResponse('Course is already full', 409);
  }

  if (!studentId) {
    const lead = getLead(enquiry);
    if (!lead.email && !lead.first_name) {
      return errorResponse('Booking enquiry has no student details', 400);
    }
    studentId = await findOrCreateStudent(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      ...lead,
      source: 'website',
    });
  }

  const enrolRes = await fetch(`${SUPABASE_URL}/rest/v1/enrolments`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ student_id: studentId, course_id: courseId }),
  });
  if (!enrolRes.ok) {
    console.error('handle-course-booking enrolment error:', await enrolRes.text());
    return errorResponse('Could not enrol student');
  }

  await setStudentStatus(SUPABASE_URL, SUPABASE_SERVICE_KEY, studentId, 'active');

  const updated = await patchEnquiry(SUPABASE_URL, H, enquiryId, {
    status: 'confirmed',
    student_id: studentId,
  });
  if (!updated) return errorResponse('Student enrolled, but enquiry could not be updated');

  return jsonResponse({
    success: true,
    status: updated.status,
    course_id: courseId,
    student_id: studentId,
  });
}, 'handle-course-booking');
