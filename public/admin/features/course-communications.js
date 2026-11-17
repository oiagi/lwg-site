/* ── Course communications ────────────────────────────────────────────
   Course-level send actions: starting-soon, schedule and feedback emails
   (through the confirm-send modal, which shows the exact email) and the
   certificate / contract / invoice modal openers. All of them read the shared coursesCache owned by courses.js;
   refreshCourseInCache mutates entries in place so the cache stays the
   single source of truth.                                              */
import { apiFetch } from '../core/api.js';
import { showMessage } from '../core/helpers.js';
import { openConfirmSend } from './confirm-send.js';
import { fetchEmailPreview } from './email-preview.js';
import { openCertificateModal as openCertificates } from './certificates.js';
import { openContractModal as openContracts } from './contracts.js';
import { openBulkInvoiceModal as openBulkInvoices } from './invoices.js';
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

const SEND_LANGUAGES = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];

/* Every course-level send that runs through the confirm-send modal works the
   same way: refresh the course, list the enrolled students with an email
   address, show the exact email for one of them (the endpoint called with
   `preview: true`) and post the same body for the ticked students. */
async function openCourseSend({
  courseId,
  title,
  endpoint,
  msgId,
  extraBody = {},
  hint = '',
  hintFor = null,
  resultLabel = null,
}) {
  let course;
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

  openConfirmSend({
    title,
    recipients,
    hint: hintFor ? hintFor(course) : hint,
    languageOptions: SEND_LANGUAGES,
    defaultLanguage: 'de',
    selectableRecipients: true,
    loadPreview: ({ language, recipient }) =>
      fetchEmailPreview(endpoint, {
        course_id: courseId,
        student_ids: [recipient.student_id],
        language,
        ...extraBody,
      }),
    onConfirm: async ({ language, recipients: selectedRecipients }) => {
      if (!selectedRecipients.length) throw new Error('Select at least one recipient.');
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: {
          course_id: courseId,
          student_ids: selectedRecipients.map((r) => r.student_id),
          language,
          ...extraBody,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const label = resultLabel
        ? resultLabel(body)
        : `sent to ${body.sent || 0}` + (body.failed ? ` · ${body.failed} failed` : '');
      const msg = document.getElementById(msgId);
      if (msg) showMessage(msg, label);
    },
  });
}

export function openStartingSoonModal(courseId) {
  return openCourseSend({
    courseId,
    title: 'send course starting soon',
    endpoint: '/api/send-course-confirmation',
    extraBody: { variant: 'starting_soon' },
    msgId: 'starting-soon-msg-' + courseId,
  });
}

export function openScheduleModal(courseId) {
  return openCourseSend({
    courseId,
    title: 'send schedule update',
    endpoint: '/api/send-session-schedule',
    msgId: 'schedule-msg-' + courseId,
  });
}

const FEEDBACK_TITLES = {
  midterm: 'request mid-course feedback',
  final: 'request final feedback',
};

export function openFeedbackRequestModal(courseId, kind = 'final') {
  if (!FEEDBACK_TITLES[kind]) {
    alert('Unknown feedback form.');
    return undefined;
  }
  // Everyone is listed and ticked: responses are anonymous, so there is no
  // "already answered" to show. The server quietly skips students who have
  // submitted this form and leaves earlier links valid.
  return openCourseSend({
    courseId,
    title: FEEDBACK_TITLES[kind],
    endpoint: '/api/send-feedback-request',
    extraBody: { kind },
    msgId: `feedback-msg-${kind}-${courseId}`,
    hintFor: (course) => {
      const asked = (course.students || []).filter(
        (s) => s.email && s.feedback_requested?.[kind]
      ).length;
      return (
        'Anonymous: each student gets a private link, valid for 90 days, one submission each. Anyone who has already answered is skipped.' +
        (asked ? ` ${asked} of these students were asked before and keep their original link.` : '')
      );
    },
  });
}

export function openCertificateModal(courseId) {
  return openCertificates(courseId, coursesCache);
}

export function openContractModal(courseId) {
  return openContracts(courseId, coursesCache);
}

/* The combined dialog: confirmation, invoice and questionnaire, chosen per
   student. Refreshed first so "already invoiced" / "answered" are current. */
export async function openBulkInvoiceModal(courseId) {
  try {
    await refreshCourseInCache(courseId);
  } catch (err) {
    alert(err.message || 'Could not refresh course data.');
    return;
  }
  openBulkInvoices(courseId, coursesCache);
}
