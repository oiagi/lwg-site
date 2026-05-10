// functions/api/book-course.js
// POST /api/book-course
// Body: { course_id, student: { first_name, last_name, email, ...intake fields } }
//
// Creates a pending direct-booking enquiry for an existing public group course.
// It does not create an enrolment and does not trigger payment.

import {
  supabaseHeaders,
  jsonResponse,
  errorResponse,
  validateOrigin,
  checkRateLimit,
  withErrorHandling,
  parseJsonBody,
  pickDefined,
  normalizePageLanguage,
} from './_utils.js';
import { validate } from './_validate.js';
import { findOrCreateStudent, getOrCreateStudentToken } from './_student-utils.js';
import {
  isPublicCourseEligible,
  loadPublicCourseCandidates,
  publicCourseDto,
  PUBLIC_BOOKING_STATUS,
} from './_public-course-booking.js';

const NOTIFY_EMAILS = ['info@learningwithgioia.ch'];
const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';

const STUDENT_FIELDS = [
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
  'billing_email',
  'billing_phone',
  'billing_street',
  'billing_street_number',
  'billing_postcode',
  'billing_city',
  'consent_given',
  'consent_date',
];

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanString(value, max = 320) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function emailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function missingRequired(student, fields) {
  return fields.find((field) => !student[field]);
}

function normalizeStudent(input) {
  const raw = pickDefined(input || {}, STUDENT_FIELDS);
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'boolean') out[key] = value;
    else out[key] = cleanString(value, key === 'email' || key === 'billing_email' ? 320 : 200);
  }
  out.consent_given = input?.consent_given === true;
  out.consent_date = out.consent_given ? new Date().toISOString() : null;
  if (!['female', 'male', 'other'].includes(out.gender)) {
    out.gender = null;
    out.gender_note = null;
  } else if (out.gender !== 'other') {
    out.gender_note = null;
  }
  return out;
}

function buildBillingAddress(student) {
  const streetLine = [student.billing_street, student.billing_street_number]
    .filter(Boolean)
    .join(' ');
  const cityLine = [student.billing_postcode, student.billing_city].filter(Boolean).join(' ');
  return [streetLine, cityLine].filter(Boolean).join(', ') || null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bookingTotal(course) {
  const pricePer60 = numberOrNull(course.price_per_person_per_60min);
  const lessons = numberOrNull(course.sessions_remaining);
  if (pricePer60 === null || lessons === null) return null;

  const sessionLength = numberOrNull(course.session_length_minutes) || 60;
  return pricePer60 * lessons * (sessionLength / 60);
}

function formatPrice(amount, currency) {
  if (amount === null || amount === undefined) return '—';
  return `${Number(amount).toFixed(2)} ${currency || 'CHF'}`;
}

function buildCustomerEmail(course, student, language = 'en', intakeUrl = null) {
  const total = bookingTotal(course);
  const isGerman = language === 'de';
  const starts = new Date(course.first_session_at).toLocaleString(isGerman ? 'de-CH' : 'en-GB', {
    timeZone: 'Europe/Zurich',
  });
  const copy = isGerman
    ? {
        subject: `Buchungsanfrage erhalten — ${course.level || course.course_type || 'Gruppenkurs'} · learning with gioia`,
        htmlLang: 'de',
        greeting: `Danke, ${esc(student.first_name || 'du')} :)`,
        intro: 'Wir haben deine Buchungsanfrage erhalten. So geht es weiter:',
        stepConfirm: 'Wir bestätigen deine Anfrage so schnell wie möglich.',
        stepIntake:
          'Bitte füll in der Zwischenzeit dieses Formular aus. Ohne diese Informationen können wir dich nicht in einen Kurs einschreiben!',
        stepIntakeBtn: 'Formular ausfüllen →',
        stepPaymentRequest: 'Du erhältst die Zahlungsinformationen für deinen Kurs.',
        stepPay: 'Du bezahlst die Rechnung.',
        stepDone: 'Fertig! Dein Platz im Kurs ist reserviert.',
        course: 'Kurs',
        starts: 'Start',
        place: 'Ort',
        totalPrice: 'Gesamtpreis',
      }
    : {
        subject: `Booking request received — ${course.level || course.course_type || 'group course'} · learning with gioia`,
        htmlLang: 'en',
        greeting: `Thank you, ${esc(student.first_name || 'there')} :)`,
        intro: "We've received your booking request. What happens next:",
        stepConfirm: 'We will confirm your request shortly.',
        stepIntake:
          'In the meantime, please complete this form. Without this information we cannot enrol you in the course!',
        stepIntakeBtn: 'Complete the form →',
        stepPaymentRequest: 'You will receive the payment request for your course.',
        stepPay: 'You pay the bill.',
        stepDone: "Done! You're all set for your course.",
        course: 'Course',
        starts: 'Starts',
        place: 'Place',
        totalPrice: 'Total price',
      };

  const intakeLinkHtml = intakeUrl
    ? `<a href="${esc(intakeUrl)}" style="display:inline-block;background:#1a1a1a;color:#d6eaf8;text-decoration:none;padding:8px 12px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-top:6px;">${copy.stepIntakeBtn}</a>`
    : '';

  const steps = [
    `<li style="margin-bottom:8px;">${esc(copy.stepConfirm)}</li>`,
    `<li style="margin-bottom:8px;">${esc(copy.stepIntake)}${intakeLinkHtml ? '<br>' + intakeLinkHtml : ''}</li>`,
    `<li style="margin-bottom:8px;">${esc(copy.stepPaymentRequest)}</li>`,
    `<li style="margin-bottom:8px;">${esc(copy.stepPay)}</li>`,
    `<li>${esc(copy.stepDone)}</li>`,
  ].join('');

  return {
    subject: copy.subject,
    html: `<!DOCTYPE html>
<html lang="${copy.htmlLang}">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:32px 40px;">
          <p style="margin:0;color:#d6eaf8;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;">learning with gioia</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 24px;font-size:22px;color:#1a1a1a;">${copy.greeting}</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#333;">
            ${esc(copy.intro)}
          </p>
          <ul style="margin:0 0 28px 20px;padding:0;font-size:15px;line-height:1.7;color:#333;">
            ${steps}
          </ul>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
            <tr><td style="padding:6px 0;color:#888;font-size:13px;">${copy.course}</td><td style="padding:6px 0 6px 24px;font-size:13px;">${esc(course.subject || course.course_type || 'Group course')} · ${esc(course.level || '—')}</td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:13px;">${copy.starts}</td><td style="padding:6px 0 6px 24px;font-size:13px;">${esc(starts)}</td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:13px;">${copy.place}</td><td style="padding:6px 0 6px 24px;font-size:13px;">${esc(course.location_text)}</td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:13px;">${copy.totalPrice}</td><td style="padding:6px 0 6px 24px;font-size:13px;">${esc(formatPrice(total, course.currency))}</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function buildNotificationEmail(course, student, enquiryId, courseUrl) {
  const courseLink = courseUrl
    ? `<tr>
            <td colspan="2" style="padding:18px 0 0;">
              <a href="${esc(courseUrl)}" style="display:inline-block;background:#1a1a1a;color:#d6eaf8;text-decoration:none;padding:10px 14px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">Open requested course</a>
            </td>
          </tr>`
    : '';
  return {
    subject: `Direct course booking request — ${student.first_name || ''} ${student.last_name || ''}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f8fb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a1a;padding:24px 40px;">
          <p style="margin:0;color:#d6eaf8;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">direct booking request</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;">
            <tr><td style="padding:6px 0;color:#888;font-size:13px;">Enquiry ID</td><td style="padding:6px 0 6px 24px;font-size:13px;">${esc(enquiryId)}</td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:13px;">Course</td><td style="padding:6px 0 6px 24px;font-size:13px;">${esc(course.course_code || '—')} · ${esc(course.level || '—')}</td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:13px;">Student</td><td style="padding:6px 0 6px 24px;font-size:13px;">${esc([student.first_name, student.last_name].filter(Boolean).join(' '))}</td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:13px;">Email</td><td style="padding:6px 0 6px 24px;font-size:13px;">${esc(student.email)}</td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:13px;">Phone</td><td style="padding:6px 0 6px 24px;font-size:13px;">${esc(student.phone || '—')}</td></tr>
            ${courseLink}
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function adminCourseUrl(request, env, courseId) {
  const base = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
  return `${base}/admin/#courses/${encodeURIComponent(courseId)}`;
}

async function sendEmail(env, to, email) {
  if (!env.RESEND_API_KEY) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      reply_to: NOTIFY_EMAILS,
      subject: email.subject,
      html: email.html,
    }),
  });
  if (!res.ok) console.error('book-course email error:', await res.text());
  return res.ok;
}

export const onRequestPost = withErrorHandling(async ({ request, env }) => {
  const originErr = validateOrigin(request, env);
  if (originErr) return originErr;

  const rateLimitErr = await checkRateLimit(request, { maxRequests: 5, windowSeconds: 60 });
  if (rateLimitErr) return rateLimitErr;

  const { body, error } = await parseJsonBody(request);
  if (error) return error;

  const courseId = cleanString(body.course_id, 80);
  if (!courseId) return errorResponse('course_id is required', 400);

  const billingSeparate = body.student?.billing_separate === true;
  const student = normalizeStudent(body.student || {});
  const studentErr = validate(student, {
    first_name: { required: true, type: 'string', maxLength: 200 },
    last_name: { required: true, type: 'string', maxLength: 200 },
    gender: {
      required: true,
      type: 'string',
      oneOf: ['she/her', 'he/him', 'they/them', 'other', 'female', 'male'],
    },
    email: { required: true, type: 'string', email: true, maxLength: 320 },
    consent_given: { required: true, type: 'boolean', oneOf: [true] },
  });
  if (studentErr) return errorResponse(studentErr, 400);
  if (student.gender === 'other' && !student.gender_note) {
    return errorResponse('gender_note is required when gender is other', 400);
  }
  const missing = missingRequired(student, [
    'phone',
    'street',
    'street_number',
    'postcode',
    'city',
    'emergency_contact',
    'ec_relationship',
    'ec_phone',
    'ec_email',
  ]);
  if (missing) return errorResponse(`${missing} is required`, 400);
  if (!emailValid(student.ec_email)) return errorResponse('ec_email must be valid', 400);
  if (
    billingSeparate ||
    [
      'billing_name',
      'billing_email',
      'billing_phone',
      'billing_street',
      'billing_street_number',
      'billing_postcode',
      'billing_city',
    ].some((field) => student[field])
  ) {
    const missingBilling = missingRequired(student, [
      'billing_name',
      'billing_email',
      'billing_phone',
      'billing_street',
      'billing_street_number',
      'billing_postcode',
      'billing_city',
    ]);
    if (missingBilling) return errorResponse(`${missingBilling} is required`, 400);
    if (!emailValid(student.billing_email))
      return errorResponse('billing_email must be valid', 400);
  }

  const language = normalizePageLanguage(body.language);

  const candidates = await loadPublicCourseCandidates(env, courseId);
  const course = candidates[0];
  if (!course || !isPublicCourseEligible(course, course.pending_booking_count)) {
    return errorResponse('This course is no longer available for direct booking.', 409);
  }

  const publicCourse = publicCourseDto(course, course.pending_booking_count);
  const totalPrice = bookingTotal(publicCourse);
  const booking = {
    type: 'direct_course_booking',
    lessonType: `${course.course_type || 'Group course'} ${course.level || ''}`.trim(),
    course_id: course.id,
    course_code: course.course_code || null,
    course_type: course.course_type || null,
    level: course.level || null,
    first_session_at: publicCourse.first_session_at,
    location_text: publicCourse.location_text,
    spots_remaining_at_booking: publicCourse.spots_remaining,
    total_price: totalPrice,
    currency: publicCourse.currency,
    payment_note: 'Payment after personal confirmation.',
    language,
  };
  const contact = {
    lead: {
      firstName: student.first_name,
      lastName: student.last_name,
      gender: student.gender || null,
      genderNote: student.gender_note || null,
      email: student.email,
      phone: student.phone || null,
    },
    participants: [
      {
        firstName: student.first_name,
        lastName: student.last_name,
        gender: student.gender || null,
        genderNote: student.gender_note || null,
        email: student.email,
        phone: student.phone || null,
      },
    ],
    intake: student,
    language,
  };

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;
  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  let enquiryId;
  let studentId = null;
  try {
    const enquiryRes = await fetch(`${SUPABASE_URL}/rest/v1/enquiries`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify({
        service: course.course_type || null,
        lead_first: student.first_name,
        lead_last: student.last_name,
        lead_email: student.email,
        lead_phone: student.phone || null,
        booking_data: booking,
        contact_data: contact,
        course_id: course.id,
        status: PUBLIC_BOOKING_STATUS,
      }),
    });
    if (!enquiryRes.ok) {
      console.error('book-course enquiry error:', await enquiryRes.text());
      return errorResponse('Could not save booking request');
    }

    const rows = await enquiryRes.json();
    enquiryId = rows[0]?.id;

    try {
      studentId = await findOrCreateStudent(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        first_name: student.first_name,
        last_name: student.last_name,
        gender: student.gender,
        gender_note: student.gender_note,
        email: student.email,
        phone: student.phone,
        postcode: student.postcode,
        source: 'website',
      });
      await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${studentId}`, {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify({
          ...student,
          billing_address: buildBillingAddress(student),
        }),
      });
      await fetch(`${SUPABASE_URL}/rest/v1/enquiries?id=eq.${enquiryId}`, {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify({ student_id: studentId }),
      });
    } catch (err) {
      console.error('book-course student link error (non-fatal):', err);
    }
  } catch (err) {
    console.error('book-course error:', err);
    return errorResponse('Could not save booking request');
  }

  let intakeFormUrl = null;
  if (studentId) {
    try {
      const token = await getOrCreateStudentToken(SUPABASE_URL, SUPABASE_SERVICE_KEY, studentId);
      if (token) {
        const base = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
        intakeFormUrl = `${base}/intake.html?token=${encodeURIComponent(token)}`;
      }
    } catch (err) {
      console.error('book-course intake token error (non-fatal):', err);
    }
  }

  await Promise.allSettled([
    sendEmail(
      env,
      student.email,
      buildCustomerEmail(publicCourse, student, language, intakeFormUrl)
    ),
    sendEmail(
      env,
      NOTIFY_EMAILS,
      buildNotificationEmail(
        publicCourse,
        student,
        enquiryId,
        adminCourseUrl(request, env, course.id)
      )
    ),
  ]);

  return jsonResponse({ success: true, id: enquiryId, student_id: studentId });
}, 'book-course');
