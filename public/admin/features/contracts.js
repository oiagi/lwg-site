/* ── Course contracts ─────────────────────────────────────────────────
   Sends a pre-signed course contract PDF to enrolled students. Students
   print, sign and upload it via a personalised public page; the signed
   copy then shows up on the course and in the student record.          */
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
const PROVIDER_NAME = 'learning with gioia';
const PROVIDER_CITY = 'Zürich';

/* ── Standardised contract terms ──────────────────────────────────
   Edit the wording here; each entry renders as one numbered clause. */
const CONTRACT_TERMS_DE = [
  {
    title: 'Vertragsgegenstand',
    text: 'Dieser Vertrag regelt die Teilnahme am oben aufgeführten Kurs bei learning with gioia.',
  },
  {
    title: 'Kursgeld und Zahlung',
    text: 'Das Kursgeld richtet sich nach den oben genannten Konditionen und wird per Rechnung gestellt. Die Rechnung ist innert der darauf angegebenen Frist zu begleichen.',
  },
  {
    title: 'Absenzen',
    text: 'Verpasste Lektionen werden nicht zurückerstattet. Eine Verschiebung einzelner Lektionen ist nach Absprache und mit mindestens 24 Stunden Vorlauf möglich.',
  },
  {
    title: 'Allgemeine Geschäftsbedingungen',
    text: 'Im Übrigen gelten die Allgemeinen Geschäftsbedingungen von learning with gioia, abrufbar unter learningwithgioia.ch/agb.',
  },
  {
    title: 'Datenschutz',
    text: 'Personendaten werden gemäss der Datenschutzerklärung unter learningwithgioia.ch/datenschutzerklaerung bearbeitet.',
  },
];

const CONTRACT_TERMS_EN = [
  {
    title: 'Subject of the agreement',
    text: 'This agreement governs participation in the course listed above at learning with gioia.',
  },
  {
    title: 'Course fee and payment',
    text: 'The course fee follows the conditions listed above and is billed by invoice. The invoice is payable within the period stated on it.',
  },
  {
    title: 'Missed lessons',
    text: 'Missed lessons are not refunded. Individual lessons may be rescheduled by arrangement with at least 24 hours notice.',
  },
  {
    title: 'General terms and conditions',
    text: 'In all other respects the general terms and conditions of learning with gioia apply, available at learningwithgioia.ch/agb.',
  },
  {
    title: 'Data protection',
    text: 'Personal data is processed in accordance with the privacy policy at learningwithgioia.ch/datenschutzerklaerung.',
  },
];

let currentCourse = null;
let currentRecipients = [];
let logoDataUrl = null;
let signatureDataUrl = null;
let submitButtonBound = false;

/* ── Public: open from course-row "send contracts" button ─────────── */
export async function openContractModal(courseId, coursesCache) {
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
    street: s.street || '',
    street_number: s.street_number || '',
    postcode: s.postcode || '',
    city: s.city || '',
    contract_sent_at: s.contract_sent_at || null,
    contract_signed_at: s.contract_signed_at || null,
    selected: true,
  }));

  document.getElementById('con-course-id').value = course.id;
  document.getElementById('con-title').textContent =
    `send contracts — ${course.course_code || 'course'}`;

  const langDe = document.querySelector('input[name="con-language"][value="de"]');
  if (langDe) langDe.checked = true;

  renderRecipientList();
  await loadAssets();
  updatePreview();

  const msg = document.getElementById('con-msg');
  msg.classList.remove('is-visible-block');
  msg.textContent = '';
  const btn = document.getElementById('con-submit');
  btn.textContent = 'send contracts';
  btn.disabled = false;
  bindSubmitButton(btn);

  document.getElementById('contracts-modal').classList.add('open');
  bindOptionListeners();
}

export function closeContractModal() {
  document.getElementById('contracts-modal').classList.remove('open');
}

/* ── Recipient list rendering ───────────────────────────────────── */
function renderRecipientList() {
  const container = document.getElementById('con-students');

  container.innerHTML = currentRecipients
    .map((r, i) => {
      const name = esc([r.first_name, r.last_name].filter(Boolean).join(' ')) || esc(r.email);
      const statusTag = r.contract_signed_at
        ? ' <span class="cs-recipient-email">(signed contract already uploaded)</span>'
        : r.contract_sent_at
          ? ' <span class="cs-recipient-email">(contract already sent)</span>'
          : '';
      return `
        <label class="cert-student-row">
          <input type="checkbox" data-con-recipient="${i}" ${r.selected ? 'checked' : ''}>
          <span class="cert-student-name">${name}</span>
          <span class="cert-student-email">${esc(r.email)}</span>
          ${statusTag}
        </label>`;
    })
    .join('');

  updateCount();

  container.querySelectorAll('input[data-con-recipient]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.conRecipient, 10);
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
  document.getElementById('con-count').textContent = `(${selected} selected)`;
  document.getElementById('con-submit').disabled = selected === 0;
}

/* ── Option change listeners (live-update preview) ─────────────── */
let optionListenersBound = false;
function bindOptionListeners() {
  if (optionListenersBound) return;
  optionListenersBound = true;
  document.querySelectorAll('input[name="con-language"]').forEach((el) => {
    el.addEventListener('change', updatePreview);
  });
}

function bindSubmitButton(btn) {
  if (!btn || submitButtonBound) return;
  submitButtonBound = true;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    submitContracts();
  });
}

/* ── Contract data ──────────────────────────────────────────────── */
function getOptions() {
  const language = document.querySelector('input[name="con-language"]:checked')?.value || 'de';
  return { language };
}

function previewRecipient() {
  return currentRecipients.find((r) => r.selected) || currentRecipients[0] || null;
}

function isGroupClass(course) {
  const gt = course.group_type;
  if (gt === 'private') return false;
  if (gt === 'duo' || gt === 'group') return true;
  return (course.students || []).length >= 2;
}

function feeDisplay(course, isEN) {
  const currency = course.currency || 'CHF';
  if (course.price_per_person_per_60min) {
    const amount = Number(course.price_per_person_per_60min).toFixed(2);
    return isEN
      ? `${currency} ${amount} per person per 60 min`
      : `${currency} ${amount} pro Person pro 60 Min.`;
  }
  if (course.price_per_session) {
    const amount = Number(course.price_per_session).toFixed(2);
    return isEN ? `${currency} ${amount} per lesson` : `${currency} ${amount} pro Lektion`;
  }
  return '';
}

function buildContractData(recipient, course, opts) {
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

  const sessionsDisplay = sessions.length
    ? course.session_length_minutes
      ? `${sessions.length} × ${course.session_length_minutes}min`
      : String(sessions.length)
    : '';

  const address = formatCourseAddress(course);
  const isGroup = isGroupClass(course);
  const classTypeDisplay = isGroup
    ? isEN
      ? 'Group class (max. five persons)'
      : 'Gruppenunterricht (max. fünf Personen)'
    : isEN
      ? 'Individual class'
      : 'Einzelunterricht';

  const addrLine1 = [recipient.street, recipient.street_number].filter(Boolean).join(' ');
  const addrLine2 = [recipient.postcode, recipient.city].filter(Boolean).join(' ');
  const addressLines = [addrLine1, addrLine2].filter(Boolean);

  return {
    fullName,
    addressLines,
    courseCode: course.course_code || '',
    subject: translateSubject(course.subject || '', opts.language),
    level: course.level || '',
    location: address || course.location || '',
    classType: classTypeDisplay,
    dateRange: firstDate && lastDate ? `${fmt(firstDate)} – ${fmt(lastDate)}` : '—',
    sessionsDisplay,
    fee: feeDisplay(course, isEN),
    issueDate: new Date().toLocaleDateString(dateLocale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    isEN,
    contractRef: recipient.contract_ref || generateContractRef(),
  };
}

function strings(isEN) {
  return isEN
    ? {
        title: 'Course Agreement',
        between: 'between',
        provider: `${PROVIDER_NAME}, ${PROVIDER_CITY} ("provider")`,
        and: 'and',
        participant: '("participant")',
        courseIntro: 'concerning participation in the following course:',
        subjectLabel: 'Subject',
        levelLabel: 'Level',
        codeLabel: 'Course code',
        periodLabel: 'Period',
        sessionsLabel: 'Lessons',
        locationLabel: 'Location',
        classTypeLabel: 'Class type',
        feeLabel: 'Course fee',
        terms: CONTRACT_TERMS_EN,
        providerSigLabel: 'The provider',
        studentSigLabel: 'The participant',
        placeDateLabel: 'Place, date',
        signatureTitle: SIGNATURE_TITLE_EN,
        refLabel: 'Contract reference',
      }
    : {
        title: 'Kursvertrag',
        between: 'zwischen',
        provider: `${PROVIDER_NAME}, ${PROVIDER_CITY} («Anbieterin»)`,
        and: 'und',
        participant: '(«Teilnehmer:in»)',
        courseIntro: 'betreffend die Teilnahme am folgenden Kurs:',
        subjectLabel: 'Fach',
        levelLabel: 'Niveau',
        codeLabel: 'Kurscode',
        periodLabel: 'Zeitraum',
        sessionsLabel: 'Lektionen',
        locationLabel: 'Ort',
        classTypeLabel: 'Unterrichtsart',
        feeLabel: 'Kursgeld',
        terms: CONTRACT_TERMS_DE,
        providerSigLabel: 'Die Anbieterin',
        studentSigLabel: 'Die Teilnehmerin / der Teilnehmer',
        placeDateLabel: 'Ort, Datum',
        signatureTitle: SIGNATURE_TITLE_DE,
        refLabel: 'Vertragsnummer',
      };
}

function contractDetailRows(data, t) {
  return [
    [t.subjectLabel, data.subject],
    [t.levelLabel, data.level],
    [t.classTypeLabel, data.classType],
    [t.codeLabel, data.courseCode],
    [t.periodLabel, data.dateRange],
    [t.sessionsLabel, data.sessionsDisplay],
    [t.locationLabel, data.location],
    [t.feeLabel, data.fee],
  ].filter(([, v]) => v);
}

/* ── Preview ────────────────────────────────────────────────────── */
function buildPreviewHtml(data) {
  const t = strings(data.isEN);
  const detailRow = (k, v) =>
    `<div class="cert-prev-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`;
  const termsHtml = t.terms
    .map(
      (term, i) =>
        `<p class="contract-prev-term"><strong>${i + 1}. ${esc(term.title)}</strong> — ${esc(term.text)}</p>`
    )
    .join('');

  return `
    <div class="cert-prev-page contract-prev-page">
      ${logoDataUrl ? `<img class="cert-prev-logo" src="${logoDataUrl}" alt="">` : ''}
      <h3 class="cert-prev-title">${esc(t.title)}</h3>
      <p class="cert-prev-intro">${esc(t.between)}</p>
      <p class="contract-prev-party">${esc(t.provider)}</p>
      <p class="cert-prev-intro">${esc(t.and)}</p>
      <p class="cert-prev-name">${esc(data.fullName)}</p>
      ${data.addressLines.length ? `<p class="cert-prev-address">${data.addressLines.map((l) => esc(l)).join('<br>')}</p>` : ''}
      <p class="contract-prev-party">${esc(t.participant)}</p>
      <p class="cert-prev-body">${esc(t.courseIntro)}</p>
      <div class="cert-prev-details">
        ${contractDetailRows(data, t)
          .map(([k, v]) => detailRow(k, v))
          .join('')}
      </div>
      <div class="contract-prev-terms">${termsHtml}</div>
      <div class="contract-prev-signatures">
        <div class="contract-prev-sig-block">
          <p class="contract-prev-sig-label">${esc(t.providerSigLabel)}</p>
          ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="">` : '<div class="cert-prev-sig-placeholder">[signature]</div>'}
          <p class="cert-prev-sig-name">${esc(SIGNATURE_NAME)}</p>
          <p class="cert-prev-sig-title">${esc(t.signatureTitle)}</p>
          <p class="cert-prev-place">${esc(ISSUE_LOCATION)}, ${esc(data.issueDate)}</p>
        </div>
        <div class="contract-prev-sig-block">
          <p class="contract-prev-sig-label">${esc(t.studentSigLabel)}</p>
          <div class="contract-prev-sig-space"></div>
          <p class="cert-prev-sig-name">${esc(data.fullName)}</p>
          <p class="cert-prev-place">${esc(t.placeDateLabel)}: ____________________</p>
        </div>
      </div>
      <p class="contract-prev-ref">${esc(t.refLabel)}: ${esc(data.contractRef)}</p>
    </div>
  `;
}

function updatePreview() {
  const container = document.getElementById('con-preview');
  const opts = getOptions();
  const recipient = previewRecipient();

  if (!currentCourse || !recipient) {
    container.innerHTML = '<p class="cs-empty">Select at least one recipient to preview.</p>';
    return;
  }

  container.innerHTML = buildPreviewHtml(buildContractData(recipient, currentCourse, opts));
}

/* ── Contract reference generation ──────────────────────────────── */
function generateContractRef() {
  // Avoid 0/O/1/I to reduce ambiguity ("V" for Vertrag)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const block = (start) =>
    Array.from(bytes.slice(start, start + 4))
      .map((b) => chars[b % chars.length])
      .join('');
  return `LWG-V-${block(0)}-${block(4)}`;
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
        `Signature image could not be loaded from ${SIGNATURE_URL}: ${signatureLoadError}.`
      );
      signatureDataUrl = null;
    }
  }
}

async function loadImageAsDataUrl(url) {
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

/* ── PDF generation (A4 portrait) ───────────────────────────────── */
function buildContractPdf(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const marginX = 24;
  const contentW = pageW - marginX * 2;
  const t = strings(data.isEN);
  let y = 18;

  // Logo (centered, top)
  if (logoDataUrl) {
    try {
      const logoW = 44;
      const logoRatio = imageAspectRatio(doc, logoDataUrl) || 5.5;
      const logoH = logoW / logoRatio;
      doc.addImage(logoDataUrl, 'PNG', (pageW - logoW) / 2, y, logoW, logoH);
      y += logoH + 8;
    } catch (err) {
      console.error('addImage logo failed:', err);
      y += 10;
    }
  }

  // Title
  doc.setFont('times', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(26, 26, 26);
  doc.text(t.title, pageW / 2, y, { align: 'center' });
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 30, y + 4, pageW / 2 + 30, y + 4);
  y += 14;

  // Parties
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(t.between, pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setTextColor(26, 26, 26);
  doc.text(t.provider, pageW / 2, y, { align: 'center' });
  y += 7;
  doc.setTextColor(80, 80, 80);
  doc.text(t.and, pageW / 2, y, { align: 'center' });
  y += 7;
  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(26, 26, 26);
  doc.text(data.fullName, pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('times', 'normal');
  if (data.addressLines.length) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    for (const line of data.addressLines) {
      doc.text(line, pageW / 2, y, { align: 'center' });
      y += 4.5;
    }
  }
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(t.participant, pageW / 2, y + 1, { align: 'center' });
  y += 10;

  // Course details
  doc.text(t.courseIntro, pageW / 2, y, { align: 'center' });
  y += 8;
  const rows = contractDetailRows(data, t);
  doc.setFontSize(10.5);
  const rowHeight = 5.5;
  const labelX = pageW / 2 - 6;
  const valueX = pageW / 2 + 4;
  rows.forEach(([k, v]) => {
    doc.setTextColor(140, 140, 140);
    doc.text(k, labelX, y, { align: 'right' });
    doc.setTextColor(40, 40, 40);
    doc.text(String(v), valueX, y, { align: 'left' });
    y += rowHeight;
  });
  y += 5;

  // Standardised terms
  doc.setFontSize(9.5);
  for (let i = 0; i < t.terms.length; i++) {
    const term = t.terms[i];
    doc.setFont('times', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`${i + 1}. ${term.title}`, marginX, y);
    y += 4.5;
    doc.setFont('times', 'normal');
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(term.text, contentW);
    doc.text(lines, marginX, y);
    y += lines.length * 4 + 3;
  }

  // Signature blocks (side by side), kept above the bottom margin
  const sigTop = Math.max(y + 8, pageH - 62);
  const colW = contentW / 2 - 6;
  const leftX = marginX;
  const rightX = marginX + contentW / 2 + 6;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(t.providerSigLabel, leftX, sigTop);
  doc.text(t.studentSigLabel, rightX, sigTop);

  const sigW = 34;
  const sigH = 14;
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', leftX + 2, sigTop + 3, sigW, sigH);
    } catch (err) {
      console.error('addImage signature failed:', err);
    }
  }
  const lineY = sigTop + 3 + sigH + 2;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(leftX, lineY, leftX + colW, lineY);
  doc.line(rightX, lineY, rightX + colW, lineY);

  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(SIGNATURE_NAME, leftX, lineY + 5);
  doc.text(data.fullName, rightX, lineY + 5);
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text(t.signatureTitle, leftX, lineY + 10);
  doc.text(`${ISSUE_LOCATION}, ${data.issueDate}`, leftX, lineY + 15);
  doc.text(`${t.placeDateLabel}: ____________________`, rightX, lineY + 10);

  // Contract reference (bottom-left, small)
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(`${t.refLabel}: ${data.contractRef}`, marginX, pageH - 12);

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
export async function submitContracts() {
  const btn = document.getElementById('con-submit');
  const msg = document.getElementById('con-msg');
  msg.classList.remove('is-visible-block');

  const opts = getOptions();
  const selected = currentRecipients.filter((r) => r.selected);
  if (!selected.length) return;

  if (!signatureDataUrl) {
    const reason = signatureLoadError ? `\n\nReason: ${signatureLoadError}` : '';
    if (
      !confirm(
        `Signature image could not be loaded from ${SIGNATURE_URL}. Contracts would be sent without your signature. Proceed?${reason}`
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
      const contractRef = generateContractRef();
      const data = buildContractData({ ...r, contract_ref: contractRef }, currentCourse, opts);
      return {
        student_id: r.student_id,
        email: r.email,
        name: [r.first_name, r.last_name].filter(Boolean).join(' '),
        contract_ref: contractRef,
        pdf_base64: buildContractPdf(data),
      };
    });

    btn.textContent = 'sending…';

    const res = await apiFetch('/api/send-contracts', {
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
    const courseMsg = document.getElementById('contract-row-msg-' + currentCourse.id);
    if (courseMsg) {
      const label = `sent to ${sent}` + (failed ? ` · ${failed} failed` : '');
      showMessage(courseMsg, label);
    }

    msg.textContent = failed
      ? `Sent ${sent}, failed ${failed}. Check console for details.`
      : `Sent ${sent} contract(s).`;
    msg.className = 'modal-msg ' + (failed ? 'err' : 'success');
    msg.classList.add('is-visible-block');
    btn.textContent = failed ? 'send contracts' : 'sent';

    if (!failed) {
      setTimeout(() => closeContractModal(), MESSAGE_TIMEOUT_MS);
    } else {
      btn.disabled = false;
    }
  } catch (err) {
    msg.textContent = 'Error: ' + (err.message || err);
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    btn.textContent = 'send contracts';
    btn.disabled = false;
  }
}

/* ── Download an uploaded signed contract (admin) ───────────────── */
export async function downloadSignedContract(contractId, el) {
  const label = el?.textContent;
  if (el) {
    el.disabled = true;
    el.textContent = 'loading…';
  }
  try {
    const res = await apiFetch('/api/get-contract-file?id=' + encodeURIComponent(contractId));
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const nameMatch = disposition.match(/filename="([^"]+)"/);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nameMatch ? nameMatch[1] : 'signed-contract';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Could not download the signed contract: ' + (err.message || err));
  } finally {
    if (el) {
      el.disabled = false;
      el.textContent = label || 'view signed contract';
    }
  }
}
