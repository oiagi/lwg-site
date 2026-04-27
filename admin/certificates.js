/* ── Certificates of attendance ───────────────────────────────────── */
import { apiFetch } from './api.js';
import { esc, showMessage } from './helpers.js';
import { MESSAGE_TIMEOUT_MS } from './constants.js';

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
  currentRecipients = studentsWithEmail.map((s) => ({
    student_id: s.id,
    first_name: s.first_name || '',
    last_name: s.last_name || '',
    email: s.email,
    selected: true,
  }));

  document.getElementById('cert-course-id').value = course.id;
  const titleEl = document.getElementById('cert-title');
  titleEl.textContent = `send certificates — ${course.course_code || 'course'}`;

  const langDe = document.querySelector('input[name="cert-language"][value="de"]');
  if (langDe) langDe.checked = true;
  const inclAttCb = document.getElementById('cert-include-attendance');
  if (inclAttCb) inclAttCb.checked = false;

  renderRecipientList();
  await loadAssets();
  await loadAttendanceCounts(course.id);
  updatePreview();

  const msg = document.getElementById('cert-msg');
  msg.style.display = 'none';
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
  document.getElementById('cert-include-attendance').addEventListener('change', updatePreview);
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
  return { language, includeAttendance };
}

function previewRecipient() {
  return currentRecipients.find((r) => r.selected) || currentRecipients[0] || null;
}

function buildCertificateData(recipient, course, opts) {
  const isEN = opts.language === 'en';
  const fullName = [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || '—';

  const sessions = (course.sessions || [])
    .filter((s) => s.status !== 'cancelled')
    .map((s) => new Date(s.scheduled_at))
    .sort((a, b) => a - b);
  const firstDate = sessions[0];
  const lastDate = sessions[sessions.length - 1];
  const dateLocale = isEN ? 'en-GB' : 'de-CH';
  const fmt = (d) =>
    d ? d.toLocaleDateString(dateLocale, { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  const totalMinutes =
    course.session_length_minutes && sessions.length
      ? course.session_length_minutes * sessions.length
      : null;
  const totalHours = totalMinutes ? Math.round((totalMinutes / 60) * 10) / 10 : null;

  return {
    fullName,
    courseCode: course.course_code || '',
    subject: course.service || '',
    level: course.level || '',
    location: course.location || '',
    dateRange: firstDate && lastDate ? `${fmt(firstDate)} – ${fmt(lastDate)}` : '—',
    sessionCount: sessions.length,
    totalHours,
    attendedSessions: recipient.attended_sessions,
    totalSessions: recipient.total_sessions,
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
        sessionsLabel: 'Sessions',
        hoursLabel: 'Total hours',
        locationLabel: 'Location',
        attendance: (att, tot) => `Attended ${att} of ${tot} sessions.`,
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
        hoursLabel: 'Stunden gesamt',
        locationLabel: 'Ort',
        attendance: (att, tot) => `Anwesend in ${att} von ${tot} Lektionen.`,
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

  return `
    <div class="cert-prev-page">
      ${logoDataUrl ? `<img class="cert-prev-logo" src="${logoDataUrl}" alt="">` : ''}
      <h3 class="cert-prev-title">${esc(t.title)}</h3>
      <p class="cert-prev-intro">${esc(t.intro)}</p>
      <p class="cert-prev-name">${esc(data.fullName)}</p>
      <p class="cert-prev-body">${esc(t.body)}</p>
      <div class="cert-prev-details">
        ${detailRow(t.subjectLabel, data.subject)}
        ${detailRow(t.levelLabel, data.level)}
        ${detailRow(t.codeLabel, data.courseCode)}
        ${detailRow(t.periodLabel, data.dateRange)}
        ${detailRow(t.sessionsLabel, data.sessionCount ? String(data.sessionCount) : '')}
        ${detailRow(t.hoursLabel, data.totalHours ? String(data.totalHours) : '')}
        ${detailRow(t.locationLabel, data.location)}
      </div>
      ${attendanceLine}
      <div class="cert-prev-footer">
        <div class="cert-prev-meta">
          <span class="cert-prev-meta-label">${esc(t.certId)}</span>
          <span class="cert-prev-meta-val">${esc(data.certificateId)}</span>
        </div>
        <div class="cert-prev-signature">
          ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="">` : '<div class="cert-prev-sig-placeholder">[signature]</div>'}
          <p class="cert-prev-sig-name">${esc(SIGNATURE_NAME)}</p>
          <p class="cert-prev-sig-title">${esc(t.signatureTitle)}</p>
          <p class="cert-prev-place">${esc(ISSUE_LOCATION)}, ${esc(data.issueDate)}</p>
        </div>
      </div>
    </div>
  `;
}

function updatePreview() {
  const container = document.getElementById('cert-preview');
  const recipient = previewRecipient();
  if (!currentCourse || !recipient) {
    container.innerHTML = '<p class="cs-empty">Select at least one recipient to preview.</p>';
    return;
  }
  const opts = getOptions();
  const data = buildCertificateData(recipient, currentCourse, opts);
  container.innerHTML = buildPreviewHtml(data);
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
    } catch {
      console.warn(
        'Signature image not found at',
        SIGNATURE_URL,
        '— certificates will be issued without a signature image until the file is added.'
      );
      signatureDataUrl = null;
    }
  }
}

function loadImageAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || 800;
        const h = img.naturalHeight || 600;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image: ' + url));
    img.src = url;
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
      const logoW = 40;
      const logoH = 24;
      doc.addImage(logoDataUrl, 'PNG', (pageW - logoW) / 2, 18, logoW, logoH);
    } catch (err) {
      console.error('addImage logo failed:', err);
    }
  }

  // Title
  doc.setFont('times', 'normal');
  doc.setFontSize(28);
  doc.setTextColor(26, 26, 26);
  doc.text(t.title, pageW / 2, 60, { align: 'center' });

  // Decorative underline
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 35, 65, pageW / 2 + 35, 65);

  // Intro line
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text(t.intro, pageW / 2, 78, { align: 'center' });

  // Student name
  doc.setFont('times', 'italic');
  doc.setFontSize(24);
  doc.setTextColor(26, 26, 26);
  doc.text(data.fullName, pageW / 2, 92, { align: 'center' });

  // Body
  doc.setFont('times', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text(t.body, pageW / 2, 104, { align: 'center' });

  // Course details (two-column table, centered)
  const rows = [
    [t.subjectLabel, data.subject],
    [t.levelLabel, data.level],
    [t.codeLabel, data.courseCode],
    [t.periodLabel, data.dateRange],
    [t.sessionsLabel, data.sessionCount ? String(data.sessionCount) : ''],
    [t.hoursLabel, data.totalHours ? String(data.totalHours) : ''],
    [t.locationLabel, data.location],
  ].filter(([, v]) => v);

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  const rowHeight = 6;
  const tableTop = 114;
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

  // Signature block (right side, bottom)
  const sigCenterX = pageW - 70;
  const sigBottomY = pageH - 30;
  if (signatureDataUrl) {
    try {
      const sigW = 38;
      const sigH = 18;
      doc.addImage(
        signatureDataUrl,
        'PNG',
        sigCenterX - sigW / 2,
        sigBottomY - sigH - 10,
        sigW,
        sigH
      );
    } catch (err) {
      console.error('addImage signature failed:', err);
    }
  }
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(sigCenterX - 25, sigBottomY - 8, sigCenterX + 25, sigBottomY - 8);
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(SIGNATURE_NAME, sigCenterX, sigBottomY - 4, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(t.signatureTitle, sigCenterX, sigBottomY, { align: 'center' });
  doc.text(`${ISSUE_LOCATION}, ${data.issueDate}`, sigCenterX, sigBottomY + 5, { align: 'center' });

  // Certificate ID (bottom-left, small)
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(`${t.certId}: ${data.certificateId}`, 22, pageH - 16);

  // Return base64 (without "data:application/pdf;base64," prefix)
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1];
}

/* ── Submit ─────────────────────────────────────────────────────── */
export async function submitCertificates() {
  const btn = document.getElementById('cert-submit');
  const msg = document.getElementById('cert-msg');
  msg.style.display = 'none';

  const opts = getOptions();
  const selected = currentRecipients.filter((r) => r.selected);
  if (!selected.length) return;

  if (!signatureDataUrl) {
    if (
      !confirm(
        'Signature image not found at admin/assets/signature.png — certificates will be sent without a handwritten signature. Proceed?'
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
    msg.style.display = 'block';
    btn.textContent = failed ? 'send certificates' : 'sent ✓';

    if (!failed) {
      setTimeout(() => closeCertificateModal(), MESSAGE_TIMEOUT_MS);
    } else {
      btn.disabled = false;
    }
  } catch (err) {
    msg.textContent = 'Error: ' + (err.message || err);
    msg.className = 'modal-msg err';
    msg.style.display = 'block';
    btn.textContent = 'send certificates';
    btn.disabled = false;
  }
}
