/* ── Certificates of attendance ───────────────────────────────────── */
import { apiFetch } from '../core/api.js';
import { esc, showMessage, translateSubject } from '../core/helpers.js';
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';
import { formatCourseAddress } from './courses.js';

const LOGO_URL = '/lwg_logo.svg';
const SIGNATURE_URL = '/admin/assets/signature.png';
const SIGNATURE_NAME = 'Gioia Birukoff';
const SIGNATURE_TITLE_DE = 'Schulleitung · learning with gioia';
const SIGNATURE_TITLE_EN = 'Founder · learning with gioia';
const ISSUE_LOCATION = 'Zürich';

let currentCourse = null;
let currentRecipients = [];
let logoDataUrl = null;
let signatureDataUrl = null;

/* ── Public: open from course-row "send certificates" button ────── */
export async function openCertificateModal(courseId, coursesCache) {
  const course = coursesCache.find((c) => String(c.id) === String(courseId));
  if (!course) {
    alert('Course not found. Please reload and try again.');
    return;
  }
  const studentsWithEmail = (course.students || []).filter((s) => s.email);
  if (!studentsWithEmail.length) {
    alert('No enrolled students with an email address.');
    return;
  }

  currentCourse = course;
  currentRecipients = studentsWithEmail.map((s) => {
    const paidInv = (s.paid_invoices || [])[0] || null;
    return {
      student_id: s.id,
      first_name: s.first_name || '',
      last_name: s.last_name || '',
      email: s.email,
      subjects: s.subjects || '',
      street: s.street || '',
      street_number: s.street_number || '',
      postcode: s.postcode || '',
      city: s.city || '',
      selected: true,
      paid_invoice_amount: paidInv ? paidInv.total_amount : null,
      paid_invoice_currency: paidInv ? paidInv.currency || 'CHF' : 'CHF',
    };
  });

  document.getElementById('cert-course-id').value = course.id;
  const titleEl = document.getElementById('cert-title');
  titleEl.textContent = `send certificates — ${course.course_code || 'course'}`;

  const langDe = document.querySelector('input[name="cert-language"][value="de"]');
  if (langDe) langDe.checked = true;
  const inclAttCb = document.getElementById('cert-include-attendance');
  if (inclAttCb) inclAttCb.checked = false;
  const previewAllCb = document.getElementById('cert-preview-all');
  if (previewAllCb) previewAllCb.checked = false;

  renderRecipientList();
  await loadAssets();
  await loadAttendanceCounts(course.id);
  updatePreview();

  const msg = document.getElementById('cert-msg');
  msg.classList.remove('is-visible-block');
  msg.textContent = '';
  const btn = document.getElementById('cert-submit');
  btn.textContent = 'send certificates';
  btn.disabled = false;

  document.getElementById('certificates-modal').classList.add('open');
  bindOptionListeners();
}

export function closeCertificateModal() {
  document.getElementById('certificates-modal').classList.remove('open');
}

/* ── Recipient list rendering ───────────────────────────────────── */
function renderRecipientList() {
  const container = document.getElementById('cert-students');

  container.innerHTML = currentRecipients
    .map((r, i) => {
      const name = esc([r.first_name, r.last_name].filter(Boolean).join(' ')) || esc(r.email);
      const attLine =
        typeof r.attended_sessions === 'number'
          ? ` <span class="cs-recipient-email">(${r.attended_sessions}${r.total_sessions ? '/' + r.total_sessions : ''} attended)</span>`
          : '';
      return `
        <label class="cert-student-row">
          <input type="checkbox" data-cert-recipient="${i}" ${r.selected ? 'checked' : ''}>
          <span class="cert-student-name">${name}</span>
          <span class="cert-student-email">${esc(r.email)}</span>
          ${attLine}
        </label>`;
    })
    .join('');

  updateCount();

  container.querySelectorAll('input[data-cert-recipient]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.certRecipient, 10);
      if (currentRecipients[idx]) {
        currentRecipients[idx].selected = cb.checked;
        updateCount();
        updatePreview();
      }
    });
  });
}

function updateCount() {
  const selected = currentRecipients.filter((r) => r.selected).length;
  document.getElementById('cert-count').textContent = `(${selected} selected)`;
  document.getElementById('cert-submit').disabled = selected === 0;
}

/* ── Option change listeners (live-update preview) ─────────────── */
let optionListenersBound = false;
function bindOptionListeners() {
  if (optionListenersBound) return;
  optionListenersBound = true;
  document.querySelectorAll('input[name="cert-language"]').forEach((el) => {
    el.addEventListener('change', updatePreview);
  });
  document.getElementById('cert-include-attendance')?.addEventListener('change', updatePreview);
  document.getElementById('cert-preview-all')?.addEventListener('change', updatePreview);
}

/* ── Attendance counts (per-student) ────────────────────────────── */
async function loadAttendanceCounts(courseId) {
  try {
    const res = await apiFetch('/api/get-attendance?course_id=' + courseId);
    if (!res.ok) return;
    const sessions = await res.json();

    const totalCompleted = sessions.filter((s) => s.status === 'completed').length;
    const presentBy = {};
    for (const sess of sessions) {
      for (const rec of sess.attendance || []) {
        if (rec.present) {
          presentBy[rec.student_id] = (presentBy[rec.student_id] || 0) + 1;
        }
      }
    }
    for (const r of currentRecipients) {
      r.attended_sessions = presentBy[r.student_id] || 0;
      r.total_sessions = totalCompleted;
    }
    renderRecipientList();
  } catch (err) {
    console.error('Could not load attendance counts:', err);
  }
}

/* ── Preview ────────────────────────────────────────────────────── */
function getOptions() {
  const language = document.querySelector('input[name="cert-language"]:checked')?.value || 'de';
  const includeAttendance = document.getElementById('cert-include-attendance')?.checked || false;
  const previewAll = document.getElementById('cert-preview-all')?.checked || false;
  return { language, includeAttendance, previewAll };
}

function previewRecipient() {
  return currentRecipients.find((r) => r.selected) || currentRecipients[0] || null;
}

function certificateSubject(course) {
  return course.subject || '';
}

function buildCertificateData(recipient, course, opts) {
  const isEN = opts.language === 'en';
  const fullName = [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || '—';
  const courseType = String(course.course_type || '').toLowerCase();
  const isTutoring = courseType === 'tutoring' || courseType === 'gymivorbereitung';

  const sessions = (course.sessions || [])
    .filter((s) => s.status !== 'cancelled')
    .map((s) => new Date(s.scheduled_at))
    .sort((a, b) => a - b);
  const firstDate = sessions[0];
  const lastDate = sessions[sessions.length - 1];
  const dateLocale = isEN ? 'en-GB' : 'de-CH';
  const fmt = (d) =>
    d ? d.toLocaleDateString(dateLocale, { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  const sessionsDisplay = sessions.length
    ? course.session_length_minutes
      ? `${sessions.length} × ${course.session_length_minutes}min`
      : String(sessions.length)
    : '';

  const address = formatCourseAddress(course);
  const locationDisplay = address || course.location || '';

  const isGroup = isGroupClass(course);
  const classTypeDisplay = isGroup
    ? isEN
      ? 'Group class (max. five persons)'
      : 'Gruppenunterricht (max. fünf Personen)'
    : isEN
      ? 'Individual class'
      : 'Einzelunterricht';

  const teacher = isEN
    ? 'Specialist with a university background in linguistics'
    : 'Spezialist*in mit universitärem Hintergrund in Linguistik';

  const addrLine1 = [recipient.street, recipient.street_number].filter(Boolean).join(' ');
  const addrLine2 = [recipient.postcode, recipient.city].filter(Boolean).join(' ');
  const addressLines = [addrLine1, addrLine2].filter(Boolean);

  return {
    fullName,
    addressLines,
    courseCode: course.course_code || '',
    subject: translateSubject(certificateSubject(course), opts.language),
    level: isTutoring ? '' : course.level || '',
    location: locationDisplay,
    classType: classTypeDisplay,
    teacher,
    dateRange: firstDate && lastDate ? `${fmt(firstDate)} – ${fmt(lastDate)}` : '—',
    sessionCount: sessions.length,
    sessionsDisplay,
    attendedSessions: recipient.attended_sessions,
    totalSessions: recipient.total_sessions,
    paidAmount: recipient.paid_invoice_amount ?? null,
    paidCurrency: recipient.paid_invoice_currency || 'CHF',
    issueDate: new Date().toLocaleDateString(dateLocale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    isEN,
    includeAttendance: opts.includeAttendance,
    certificateId: recipient.certificate_id || generateCertificateId(),
  };
}

function isGroupClass(course) {
  const gt = course.group_type;
  if (gt === 'private') return false;
  if (gt === 'duo' || gt === 'group') return true;
  return (course.students || []).length >= 2;
}

function strings(isEN) {
  return isEN
    ? {
        title: 'Certificate of Attendance',
        intro: 'This is to certify that',
        body: 'has attended the following course at learning with gioia:',
        subjectLabel: 'Subject',
        levelLabel: 'Level',
        codeLabel: 'Course code',
        periodLabel: 'Period',
        sessionsLabel: 'Lessons',
        locationLabel: 'Location',
        classTypeLabel: 'Class type',
        teacherLabel: 'Teacher',
        attendance: (att, tot) => `Attended ${att} of ${tot} sessions.`,
        paymentLine: (amount, currency) =>
          `The course fee of ${currency} ${amount} has already been paid in full.`,
        contactLine: 'Please feel free to contact me if you have any questions.',
        closingLine: 'Best regards,',
        certId: 'Certificate ID',
        signatureTitle: SIGNATURE_TITLE_EN,
      }
    : {
        title: 'Teilnahmebestätigung',
        intro: 'Hiermit wird bestätigt, dass',
        body: 'am folgenden Kurs bei learning with gioia teilgenommen hat:',
        subjectLabel: 'Fach',
        levelLabel: 'Niveau',
        codeLabel: 'Kurscode',
        periodLabel: 'Zeitraum',
        sessionsLabel: 'Lektionen',
        locationLabel: 'Ort',
        classTypeLabel: 'Unterrichtsart',
        teacherLabel: 'Lehrperson',
        attendance: (att, tot) => `Anwesend in ${att} von ${tot} Lektionen.`,
        paymentLine: (amount, currency) =>
          `Die Vorauszahlung des Kursgeldes in Höhe von ${currency} ${amount} wurde bereits beglichen.`,
        contactLine: 'Bei Rückfragen stehe ich Ihnen jederzeit gerne zur Verfügung.',
        closingLine: 'Mit freundlichen Grüssen,',
        certId: 'Bestätigungsnummer',
        signatureTitle: SIGNATURE_TITLE_DE,
      };
}

function buildPreviewHtml(data) {
  const t = strings(data.isEN);
  const detailRow = (k, v) =>
    v ? `<div class="cert-prev-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>` : '';
  const attendanceLine =
    data.includeAttendance && typeof data.attendedSessions === 'number'
      ? `<p class="cert-prev-attendance">${esc(t.attendance(data.attendedSessions, data.totalSessions || data.sessionCount))}</p>`
      : '';

  const paymentText =
    data.paidAmount !== null && data.paidAmount !== undefined
      ? `<p class="cert-prev-closing-text">${esc(t.paymentLine(Number(data.paidAmount).toFixed(2), data.paidCurrency))}</p>`
      : '';

  return `
    <div class="cert-prev-page">
      ${logoDataUrl ? `<img class="cert-prev-logo" src="${logoDataUrl}" alt="">` : ''}
      <h3 class="cert-prev-title">${esc(t.title)}</h3>
      <p class="cert-prev-intro">${esc(t.intro)}</p>
      <p class="cert-prev-name">${esc(data.fullName)}</p>
      ${data.addressLines.length ? `<p class="cert-prev-address">${data.addressLines.map((l) => esc(l)).join('<br>')}</p>` : ''}
      <p class="cert-prev-body">${esc(t.body)}</p>
      <div class="cert-prev-details">
        ${detailRow(t.subjectLabel, data.subject)}
        ${detailRow(t.levelLabel, data.level)}
        ${detailRow(t.classTypeLabel, data.classType)}
        ${detailRow(t.teacherLabel, data.teacher)}
        ${detailRow(t.codeLabel, data.courseCode)}
        ${detailRow(t.periodLabel, data.dateRange)}
        ${detailRow(t.sessionsLabel, data.sessionsDisplay)}
        ${detailRow(t.locationLabel, data.location)}
      </div>
      ${attendanceLine}
      <div class="cert-prev-footer">
        <div class="cert-prev-meta">
          <span class="cert-prev-meta-label">${esc(t.certId)}</span>
          <span class="cert-prev-meta-val">${esc(data.certificateId)}</span>
        </div>
        <div class="cert-prev-sig-col">
          <div class="cert-prev-closing-block">
            ${paymentText}
            <p class="cert-prev-closing-text">${esc(t.contactLine)}</p>
            <p class="cert-prev-closing-text cert-prev-closing-salutation">${esc(t.closingLine)}</p>
          </div>
          <div class="cert-prev-signature">
            ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="">` : '<div class="cert-prev-sig-placeholder">[signature]</div>'}
            <p class="cert-prev-sig-name">${esc(SIGNATURE_NAME)}</p>
            <p class="cert-prev-sig-title">${esc(t.signatureTitle)}</p>
            <p class="cert-prev-place">${esc(ISSUE_LOCATION)}, ${esc(data.issueDate)}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updatePreview() {
  const container = document.getElementById('cert-preview');
  const opts = getOptions();
  const selectedRecipients = currentRecipients.filter((r) => r.selected);
  const recipients = opts.previewAll ? selectedRecipients : [previewRecipient()].filter(Boolean);

  if (!currentCourse || !recipients.length) {
    container.innerHTML = '<p class="cs-empty">Select at least one recipient to preview.</p>';
    return;
  }

  container.classList.toggle('cert-preview-all', opts.previewAll);
  container.innerHTML = recipients
    .map((recipient) => buildPreviewHtml(buildCertificateData(recipient, currentCourse, opts)))
    .join('');
}

/* ── Certificate ID generation ──────────────────────────────────── */
function generateCertificateId() {
  // Avoid 0/O/1/I to reduce ambiguity
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const block = (start) =>
    Array.from(bytes.slice(start, start + 4))
      .map((b) => chars[b % chars.length])
      .join('');
  return `LWG-${block(0)}-${block(4)}`;
}

/* ── Asset loading (logo + signature) ──────────────────────────── */
let signatureLoadError = null;

async function loadAssets() {
  if (!logoDataUrl) {
    try {
      logoDataUrl = await loadImageAsDataUrl(LOGO_URL);
    } catch (err) {
      console.error('Could not load logo:', err);
      logoDataUrl = null;
    }
  }
  if (!signatureDataUrl) {
    try {
      signatureDataUrl = await loadImageAsDataUrl(SIGNATURE_URL);
      signatureLoadError = null;
    } catch (err) {
      signatureLoadError = err?.message || String(err);
      console.warn(
        `Signature image could not be loaded from ${SIGNATURE_URL}: ${signatureLoadError}. ` +
          'Certificates will be issued without a signature image until the file is reachable.'
      );
      signatureDataUrl = null;
    }
  }
}

async function loadImageAsDataUrl(url) {
  // Use fetch + FileReader: gives real HTTP error messages, avoids
  // CORS quirks of <img crossorigin>, and bypasses image-cache lag.
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  const blob = await res.blob();

  // SVG: rasterise via canvas so jsPDF can embed it as PNG.
  if (blob.type === 'image/svg+xml' || /\.svg(\?|$)/i.test(url)) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await rasteriseToPngDataUrl(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

function rasteriseToPngDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Image decode failed: ' + src));
    img.src = src;
  });
}

/* ── PDF generation ─────────────────────────────────────────────── */
function buildCertificatePdf(data) {
  // jsPDF UMD attaches to window.jspdf.jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const pageH = 210;
  const t = strings(data.isEN);

  // Outer border
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.rect(10, 10, pageW - 20, pageH - 20);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.rect(13, 13, pageW - 26, pageH - 26);

  // Logo (centered, top)
  if (logoDataUrl) {
    try {
      const logoW = 52;
      const logoRatio = imageAspectRatio(doc, logoDataUrl) || 5.5;
      const logoH = logoW / logoRatio;
      doc.addImage(logoDataUrl, 'PNG', (pageW - logoW) / 2, 20, logoW, logoH);
    } catch (err) {
      console.error('addImage logo failed:', err);
    }
  }

  // Title
  doc.setFont('times', 'normal');
  doc.setFontSize(28);
  doc.setTextColor(26, 26, 26);
  doc.text(t.title, pageW / 2, 40, { align: 'center' });

  // Decorative underline
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 35, 45, pageW / 2 + 35, 45);

  // Intro line
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text(t.intro, pageW / 2, 58, { align: 'center' });

  // Student name
  doc.setFont('times', 'italic');
  doc.setFontSize(24);
  doc.setTextColor(26, 26, 26);
  doc.text(data.fullName, pageW / 2, 72, { align: 'center' });

  // Student address (if available)
  const addrOffset = data.addressLines.length * 4;
  if (data.addressLines.length) {
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    data.addressLines.forEach((line, i) => {
      doc.text(line, pageW / 2, 79 + i * 4, { align: 'center' });
    });
  }

  // Body
  doc.setFont('times', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text(t.body, pageW / 2, 84 + addrOffset, { align: 'center' });

  // Course details (two-column table, centered)
  const rows = [
    [t.subjectLabel, data.subject],
    [t.levelLabel, data.level],
    [t.classTypeLabel, data.classType],
    [t.teacherLabel, data.teacher],
    [t.codeLabel, data.courseCode],
    [t.periodLabel, data.dateRange],
    [t.sessionsLabel, data.sessionsDisplay],
    [t.locationLabel, data.location],
  ].filter(([, v]) => v);

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  const rowHeight = 5;
  const tableTop = 94 + addrOffset;
  const labelX = pageW / 2 - 8;
  const valueX = pageW / 2 + 4;
  rows.forEach(([k, v], i) => {
    const y = tableTop + i * rowHeight;
    doc.setTextColor(140, 140, 140);
    doc.text(k, labelX, y, { align: 'right' });
    doc.setTextColor(40, 40, 40);
    doc.text(String(v), valueX, y, { align: 'left' });
  });

  // Optional attendance line
  const attendanceY = tableTop + rows.length * rowHeight + 6;
  if (data.includeAttendance && typeof data.attendedSessions === 'number') {
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(
      t.attendance(data.attendedSessions, data.totalSessions || data.sessionCount),
      pageW / 2,
      attendanceY,
      { align: 'center' }
    );
  }

  // Closing text block (left) and signature block (right), both top-aligned
  const closingBlockStartY =
    (data.includeAttendance && typeof data.attendedSessions === 'number'
      ? attendanceY
      : tableTop + rows.length * rowHeight) + 8;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let closingY = closingBlockStartY;
  if (data.paidAmount !== null && data.paidAmount !== undefined) {
    doc.text(t.paymentLine(Number(data.paidAmount).toFixed(2), data.paidCurrency), 22, closingY);
    closingY += 6;
  }
  doc.text(t.contactLine, 22, closingY);
  closingY += 6;
  doc.text(t.closingLine, 22, closingY);

  // Signature block (right side, top-aligned with closing text block)
  const sigCenterX = pageW - 70;
  const sigTopY = closingBlockStartY;
  const sigW = 38;
  const sigH = 15;
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', sigCenterX - sigW / 2, sigTopY, sigW, sigH);
    } catch (err) {
      console.error('addImage signature failed:', err);
    }
  }
  const lineY = sigTopY + sigH + 1;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(sigCenterX - 25, lineY, sigCenterX + 25, lineY);
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(SIGNATURE_NAME, sigCenterX, lineY + 5, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(t.signatureTitle, sigCenterX, lineY + 10, { align: 'center' });
  doc.text(`${ISSUE_LOCATION}, ${data.issueDate}`, sigCenterX, lineY + 15, { align: 'center' });

  // Certificate ID (bottom-left, small)
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(`${t.certId}: ${data.certificateId}`, 22, pageH - 16);

  // Return base64 (without "data:application/pdf;base64," prefix)
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
}

function imageAspectRatio(doc, dataUrl) {
  try {
    const props = doc.getImageProperties(dataUrl);
    if (props?.width && props?.height) return props.width / props.height;
  } catch (err) {
    console.warn('Could not read image dimensions:', err);
  }
  return null;
}

/* ── Submit ─────────────────────────────────────────────────────── */
export async function submitCertificates() {
  const btn = document.getElementById('cert-submit');
  const msg = document.getElementById('cert-msg');
  msg.classList.remove('is-visible-block');

  const opts = getOptions();
  const selected = currentRecipients.filter((r) => r.selected);
  if (!selected.length) return;

  if (!signatureDataUrl) {
    const reason = signatureLoadError ? `\n\nReason: ${signatureLoadError}` : '';
    if (
      !confirm(
        `Signature image could not be loaded from ${SIGNATURE_URL}. Certificates will be sent without a handwritten signature. Proceed?${reason}`
      )
    ) {
      return;
    }
  }

  btn.textContent = 'preparing pdfs…';
  btn.disabled = true;

  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('PDF library not loaded — please reload the page.');
    }

    const payload = selected.map((r) => {
      const certificateId = generateCertificateId();
      const recipientWithId = { ...r, certificate_id: certificateId };
      const data = buildCertificateData(recipientWithId, currentCourse, opts);
      const pdfBase64 = buildCertificatePdf(data);
      return {
        student_id: r.student_id,
        email: r.email,
        name: [r.first_name, r.last_name].filter(Boolean).join(' '),
        certificate_id: certificateId,
        attendance_included: opts.includeAttendance,
        attended_sessions: typeof r.attended_sessions === 'number' ? r.attended_sessions : null,
        total_sessions: typeof r.total_sessions === 'number' ? r.total_sessions : null,
        pdf_base64: pdfBase64,
      };
    });

    btn.textContent = 'sending…';

    const res = await apiFetch('/api/send-certificates', {
      method: 'POST',
      body: {
        course_id: currentCourse.id,
        language: opts.language,
        recipients: payload,
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

    const sent = body.sent || 0;
    const failed = body.failed || 0;
    const courseMsg = document.getElementById('cert-row-msg-' + currentCourse.id);
    if (courseMsg) {
      const label = `sent to ${sent}` + (failed ? ` · ${failed} failed` : '');
      showMessage(courseMsg, label);
    }

    msg.textContent = failed
      ? `Sent ${sent}, failed ${failed}. Check console for details.`
      : `Sent ${sent} certificate(s).`;
    msg.className = 'modal-msg ' + (failed ? 'err' : 'success');
    msg.classList.add('is-visible-block');
    btn.textContent = failed ? 'send certificates' : 'sent';

    if (!failed) {
      setTimeout(() => closeCertificateModal(), MESSAGE_TIMEOUT_MS);
    } else {
      btn.disabled = false;
    }
  } catch (err) {
    msg.textContent = 'Error: ' + (err.message || err);
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    btn.textContent = 'send certificates';
    btn.disabled = false;
  }
}
