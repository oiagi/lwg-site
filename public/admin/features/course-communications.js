/* ── Course communications ────────────────────────────────────────────
   Course-level send actions: confirmation + schedule emails (through the
   confirm-send modal) and the certificate / contract / invoice modal
   openers. All of them read the shared coursesCache owned by courses.js;
   refreshCourseInCache mutates entries in place so the cache stays the
   single source of truth.                                              */
import { apiFetch } from '../core/api.js';
import { esc, fmtDateWithEnd, showMessage } from '../core/helpers.js';
import { openConfirmSend } from './confirm-send.js';
import { openCertificateModal as openCertificates } from './certificates.js';
import { openContractModal as openContracts } from './contracts.js';
import {
  openBulkInvoiceModal as openBulkInvoices,
  openInvoiceModal as openInvoice,
} from './invoices.js';
import { coursesCache } from './courses.js';

function studentDisplayName(s) {
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || '—';
}

async function refreshCourseInCache(courseId) {
  const res = await apiFetch('/api/get-courses?status=all');
  if (!res.ok) throw new Error('Could not refresh course data.');
  const courses = await res.json();
  const fresh = courses.find((c) => String(c.id) === String(courseId));
  if (!fresh) throw new Error('Course not found. Please reload and try again.');
  const idx = coursesCache.findIndex((c) => String(c.id) === String(courseId));
  if (idx >= 0) coursesCache[idx] = fresh;
  else coursesCache.push(fresh);
  return fresh;
}

function upcomingSessions(course) {
  return (course.sessions || [])
    .filter((s) => s.status !== 'cancelled')
    .slice()
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
}

function fmtScheduleSession(session, course) {
  const duration = session.duration_minutes ?? course.session_length_minutes ?? null;
  const label = fmtDateWithEnd(session.scheduled_at, duration);
  return duration ? `${label} (${duration} min)` : label;
}

export async function sendCourseConfirmation(courseId) {
  let course = coursesCache.find((c) => String(c.id) === String(courseId));
  if (!course) {
    alert('Course not found. Please reload and try again.');
    return;
  }
  try {
    course = await refreshCourseInCache(courseId);
  } catch (err) {
    alert(err.message || 'Could not refresh course data.');
    return;
  }
  const recipients = (course.students || [])
    .filter((s) => s.email)
    .map((s) => ({
      student_id: s.id,
      name: studentDisplayName(s),
      email: s.email,
      selected: true,
    }));
  if (!recipients.length) {
    alert('No enrolled students with an email address.');
    return;
  }

  const sessions = upcomingSessions(course);
  const sessionListHtml = sessions.length
    ? `<ol class="cs-session-list">${sessions
        .map((s) => `<li>${esc(fmtScheduleSession(s, course))}</li>`)
        .join('')}</ol>`
    : '<p class="cs-empty">No lessons scheduled yet.</p>';

  const contentHtml = `
    <p class="cs-section-label">course overview</p>
    <ul class="cs-detail-list">
      <li>Code: ${esc(course.course_code || '—')}</li>
      <li>Course type: ${esc(course.course_type || '—')}</li>
      <li>Subject: ${esc(course.subject || '—')}</li>
      <li>Level: ${esc(course.level || '—')}</li>
      <li>Sessions: ${course.sessions_total ? esc(String(course.sessions_total)) : 'open-ended'}</li>
      <li>Lesson duration: ${course.session_length_minutes ? esc(`${course.session_length_minutes} min`) : '—'}</li>
      <li>Location: ${esc(course.location || '—')}</li>
    </ul>
    <p class="cs-section-label">scheduled lessons (${sessions.length})</p>
    ${sessionListHtml}
    <p class="cs-section-label">also included</p>
    <ul class="cs-detail-list">
      <li>24-hour cancellation policy</li>
      <li>AGB / terms &amp; conditions</li>
      <li>English confirmations include both English and German AGB</li>
    </ul>
  `;

  openConfirmSend({
    title: 'send course confirmation',
    recipients,
    subject: `Kursbestätigung / Course confirmation - ${course.course_code || 'course'} · learning with gioia`,
    contentHtml,
    languageOptions: [
      { value: 'de', label: 'Deutsch' },
      { value: 'en', label: 'English' },
    ],
    defaultLanguage: 'de',
    selectableRecipients: true,
    onConfirm: async ({ language, recipients: selectedRecipients }) => {
      if (!selectedRecipients.length) throw new Error('Select at least one recipient.');
      const msg = document.getElementById('confirm-msg-' + courseId);
      const res = await apiFetch('/api/send-course-confirmation', {
        method: 'POST',
        body: {
          course_id: courseId,
          student_ids: selectedRecipients.map((r) => r.student_id),
          language,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const label = `sent to ${body.sent || 0}` + (body.failed ? ` · ${body.failed} failed` : '');
      if (msg) showMessage(msg, label);
    },
  });
}

export async function openScheduleModal(courseId) {
  let course = coursesCache.find((c) => String(c.id) === String(courseId));
  if (!course) {
    alert('Course not found. Please reload and try again.');
    return;
  }
  try {
    course = await refreshCourseInCache(courseId);
  } catch (err) {
    alert(err.message || 'Could not refresh course data.');
    return;
  }
  const recipients = (course.students || [])
    .filter((s) => s.email)
    .map((s) => ({
      student_id: s.id,
      name: studentDisplayName(s),
      email: s.email,
      selected: true,
    }));
  if (!recipients.length) {
    alert('No enrolled students with an email address.');
    return;
  }

  const sessions = upcomingSessions(course);
  const sessionListHtml = sessions.length
    ? `<ol class="cs-session-list">${sessions
        .map((s) => `<li>${esc(fmtScheduleSession(s, course))}</li>`)
        .join('')}</ol>`
    : '<p class="cs-empty">No upcoming lessons currently scheduled.</p>';

  const contentHtml = `
    <p class="cs-section-label">updated schedule for ${esc(course.course_code || 'course')} (${sessions.length})</p>
    ${sessionListHtml}
  `;

  openConfirmSend({
    title: 'send schedule update',
    recipients,
    subject: `Aktualisierter Lektionsplan / Updated lesson plan${course.course_code ? ' (' + course.course_code + ')' : ''} — learning with gioia`,
    contentHtml,
    languageOptions: [
      { value: 'de', label: 'Deutsch' },
      { value: 'en', label: 'English' },
    ],
    defaultLanguage: 'de',
    selectableRecipients: true,
    onConfirm: async ({ language, recipients: selectedRecipients }) => {
      if (!selectedRecipients.length) throw new Error('Select at least one recipient.');
      const msg = document.getElementById('schedule-msg-' + courseId);
      const res = await apiFetch('/api/send-session-schedule', {
        method: 'POST',
        body: {
          course_id: courseId,
          student_ids: selectedRecipients.map((r) => r.student_id),
          language,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const label = `sent to ${body.sent || 0}` + (body.failed ? ` · ${body.failed} failed` : '');
      if (msg) showMessage(msg, label);
    },
  });
}

export function openCertificateModal(courseId) {
  return openCertificates(courseId, coursesCache);
}

export function openContractModal(courseId) {
  return openContracts(courseId, coursesCache);
}

export function openInvoiceModal(courseId, studentId) {
  openInvoice(courseId, studentId, coursesCache);
}

export function openBulkInvoiceModal(courseId) {
  openBulkInvoices(courseId, coursesCache);
}
