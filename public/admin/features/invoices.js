/* ── Invoices ───────────────────────────────────────────────────── */
import { apiFetch } from '../core/api.js';
import { esc, showMessage, translateSubject } from '../core/helpers.js';
import { MESSAGE_TIMEOUT_MS } from '../core/constants.js';

const SENDER = {
  name: 'Birukoff World c/o Gioia Birukoff',
  street: 'Wildbachstrasse 65',
  city: '8008 Zürich',
  phone: '+41 76 654 40 88',
  email: 'info@learningwithgioia.ch',
  vat: 'CHE-396.783.072 MWST',
};

let currentCourse = null;
let currentStudent = null;
let currentBulkRecipients = [];
let qrDataUrl = null;
let qrPdfBytes = null;
let qrFileType = null;
let qrPdfObjectUrl = null;

export async function openInvoiceModal(courseId, studentId, coursesCache) {
  const course = coursesCache.find((c) => String(c.id) === String(courseId));
  const student = course?.students?.find((s) => String(s.id) === String(studentId));
  if (!course || !student) {
    alert('Course or student not found. Please reload and try again.');
    return;
  }
  if (!student.email && !student.billing_email) {
    alert('This student has no email address.');
    return;
  }

  currentCourse = course;
  currentStudent = student;
  currentBulkRecipients = [];
  qrDataUrl = null;
  qrPdfBytes = null;
  qrFileType = null;
  revokeQrPdfObjectUrl();

  const titleEl = document.getElementById('invoice-title');
  titleEl.textContent = `send invoice — ${studentName(student)}`;
  renderBulkInvoiceRecipients([]);

  const msg = document.getElementById('inv-msg');
  msg.style.display = 'none';
  msg.textContent = '';
  const btn = document.getElementById('inv-submit');
  btn.textContent = 'send invoice';
  btn.disabled = false;

  const data = buildDefaultInvoiceData('');
  setVal('inv-course-id', course.id);
  setVal('inv-student-id', student.id);
  setVal('inv-number', data.invoiceNumber);
  setVal('inv-customer-reference', data.customerReference);
  setVal('inv-date', data.invoiceDate);
  setVal('inv-due-date', data.dueDate);
  setVal('inv-subject', data.subject);
  setVal('inv-quantity', data.quantity);
  setVal('inv-unit-price', data.unitPrice);
  setVal('inv-total', data.totalAmount);
  setVal('inv-recipient-email', data.email);
  document.querySelector('input[name="inv-language"][value="de"]').checked = true;

  const fileEl = document.getElementById('inv-qr-file');
  if (fileEl) fileEl.value = '';
  btn.textContent = 'send invoice';
  btn.disabled = false;

  bindInvoiceListeners();
  updateInvoicePreview();
  document.getElementById('invoice-modal').classList.add('open');

  loadNextInvoiceNumber().then((invoiceNumber) => {
    if (invoiceNumber && !val('inv-number')) {
      setVal('inv-number', invoiceNumber);
      updateInvoicePreview();
    }
  });
}

export async function openBulkInvoiceModal(courseId, coursesCache) {
  const course = coursesCache.find((c) => String(c.id) === String(courseId));
  if (!course) {
    alert('Course not found. Please reload and try again.');
    return;
  }

  const skippedOpen = (course.students || []).filter((s) => (s.open_invoices || []).length);
  const recipients = (course.students || []).filter(
    (s) => (s.email || s.billing_email) && !(s.open_invoices || []).length
  );

  if (!recipients.length) {
    alert(
      skippedOpen.length
        ? 'No invoices to send. Every student with an email already has an open invoice for this course.'
        : 'No students with email addresses were found for this course.'
    );
    return;
  }

  currentCourse = course;
  currentStudent = recipients[0];
  currentBulkRecipients = recipients.map((s) => ({ ...s, selected: true }));
  qrDataUrl = null;
  qrPdfBytes = null;
  qrFileType = null;
  revokeQrPdfObjectUrl();

  const titleEl = document.getElementById('invoice-title');
  titleEl.textContent = `send invoices — ${course.course_code || 'course'}`;

  const msg = document.getElementById('inv-msg');
  msg.style.display = 'none';
  msg.textContent = '';
  const btn = document.getElementById('inv-submit');
  btn.textContent = `send ${currentBulkRecipients.length} invoices`;
  btn.disabled = false;

  const data = buildDefaultInvoiceData('');
  setVal('inv-course-id', course.id);
  setVal('inv-student-id', '');
  setVal('inv-number', data.invoiceNumber);
  setVal('inv-customer-reference', data.customerReference);
  setVal('inv-date', data.invoiceDate);
  setVal('inv-due-date', data.dueDate);
  setVal('inv-subject', data.subject);
  setVal('inv-quantity', data.quantity);
  setVal('inv-unit-price', data.unitPrice);
  setVal('inv-total', data.totalAmount);
  setVal('inv-recipient-email', billingEmail(currentStudent));
  document.querySelector('input[name="inv-language"][value="de"]').checked = true;

  const fileEl = document.getElementById('inv-qr-file');
  if (fileEl) fileEl.value = '';

  renderBulkInvoiceRecipients(currentBulkRecipients, skippedOpen);
  bindInvoiceListeners();
  updateInvoicePreview();
  document.getElementById('invoice-modal').classList.add('open');

  loadNextInvoiceNumber().then((invoiceNumber) => {
    if (invoiceNumber && !val('inv-number')) {
      setVal('inv-number', invoiceNumber);
      updateInvoicePreview();
    }
  });
}

export function closeInvoiceModal() {
  document.getElementById('invoice-modal').classList.remove('open');
  currentBulkRecipients = [];
  renderBulkInvoiceRecipients([]);
  revokeQrPdfObjectUrl();
}

let listenersBound = false;
function bindInvoiceListeners() {
  if (listenersBound) return;
  listenersBound = true;
  [
    'inv-number',
    'inv-customer-reference',
    'inv-date',
    'inv-due-date',
    'inv-subject',
    'inv-quantity',
    'inv-unit-price',
    'inv-total',
    'inv-recipient-email',
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (id === 'inv-quantity' || id === 'inv-unit-price') updateTotalFromParts();
      updateInvoicePreview();
    });
  });
  document.querySelectorAll('input[name="inv-language"]').forEach((el) => {
    el.addEventListener('change', () => {
      const lang = currentLang();
      setVal(
        'inv-subject',
        formalCourseLabel(currentCourse, lang) || currentCourse?.course_code || ''
      );
      updateInvoicePreview();
    });
  });
  document.getElementById('inv-qr-file')?.addEventListener('change', handleQrFile);
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function revokeQrPdfObjectUrl() {
  if (!qrPdfObjectUrl) return;
  URL.revokeObjectURL(qrPdfObjectUrl);
  qrPdfObjectUrl = null;
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function numVal(id) {
  const n = Number(val(id).replace("'", '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function studentName(student) {
  return [student.first_name, student.last_name].filter(Boolean).join(' ') || student.email || '—';
}

function billingName(student) {
  return student.billing_name || studentName(student);
}

function billingEmail(student) {
  return student.billing_email || student.email || '';
}

function billingAddressLines(student) {
  const street = [
    student.billing_street || student.street,
    student.billing_street_number || student.street_number,
  ]
    .filter(Boolean)
    .join(' ');
  const city = [student.billing_postcode || student.postcode, student.billing_city || student.city]
    .filter(Boolean)
    .join(' ');
  return [billingName(student), street, city].filter(Boolean);
}

function formalGreeting(data) {
  const lastName = data.recipientLastName || '';
  const fullName = [data.recipientFirstName, data.recipientLastName].filter(Boolean).join(' ');
  if (data.language === 'en') {
    if (data.recipientGender === 'female' && lastName) return `Dear Ms ${lastName},`;
    if (data.recipientGender === 'male' && lastName) return `Dear Mr ${lastName},`;
    return fullName ? `Dear ${fullName},` : 'Dear Sir or Madam,';
  }
  if (data.recipientGender === 'female' && lastName) return `Sehr geehrte Frau ${lastName}`;
  if (data.recipientGender === 'male' && lastName) return `Sehr geehrter Herr ${lastName}`;
  return fullName ? `Guten Tag ${fullName}` : 'Sehr geehrte Damen und Herren';
}

function renderBulkInvoiceRecipients(recipients, skipped = []) {
  const wrap = document.getElementById('inv-bulk-recipients');
  if (!wrap) return;
  if (!recipients.length) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }
  const skippedText = skipped.length
    ? `<p class="label-hint">${skipped.length} student(s) skipped because they already have an open invoice for this course.</p>`
    : '';
  wrap.style.display = 'block';
  wrap.innerHTML = `
    <label>Recipients <span class="cs-meta" id="inv-bulk-count"></span></label>
    <div class="invoice-recipient-list">
      ${recipients
        .map(
          (s, i) => `
            <label class="invoice-recipient-row">
              <input type="checkbox" data-invoice-recipient="${i}" ${s.selected ? 'checked' : ''}>
              <span class="invoice-recipient-name">${esc(studentName(s))}</span>
              <span class="invoice-recipient-email">${esc(billingEmail(s))}</span>
            </label>`
        )
        .join('')}
    </div>
    ${skippedText}`;

  updateBulkInvoiceCount();

  wrap.querySelectorAll('input[data-invoice-recipient]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.invoiceRecipient, 10);
      if (currentBulkRecipients[idx]) {
        currentBulkRecipients[idx].selected = cb.checked;
        syncBulkInvoicePreviewRecipient();
        updateBulkInvoiceCount();
        updateInvoicePreview();
      }
    });
  });
}

function selectedBulkRecipients() {
  return currentBulkRecipients.filter((s) => s.selected);
}

function syncBulkInvoicePreviewRecipient() {
  if (!currentBulkRecipients.length) return;
  currentStudent = selectedBulkRecipients()[0] || currentBulkRecipients[0];
  setVal('inv-recipient-email', billingEmail(currentStudent));
}

function updateBulkInvoiceCount() {
  const selected = selectedBulkRecipients().length;
  const countEl = document.getElementById('inv-bulk-count');
  if (countEl) countEl.textContent = `(${selected} selected)`;
  const btn = document.getElementById('inv-submit');
  if (!btn || !currentBulkRecipients.length) return;
  btn.disabled = selected === 0;
  btn.textContent = selected === 1 ? 'send 1 invoice' : `send ${selected} invoices`;
}

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function firstCourseDate(course) {
  const dates = (course.sessions || [])
    .filter((s) => s.status !== 'cancelled')
    .map((s) => new Date(s.scheduled_at))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  return dates[0] || null;
}

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formalCourseLabel(course, lang = 'de') {
  const courseType = String(course.course_type || '').toLowerCase();
  const rawSubject = course.subject || titleCase(course.course_type);
  const subject = translateSubject(rawSubject, lang);
  const level = courseType === 'tutoring' || courseType === 'gymivorbereitung' ? '' : course.level;
  return [subject, level, course.course_code].filter(Boolean).join(' · ');
}

function courseQuantity(course) {
  return Number(course.sessions_total || course.sessions?.length || 1);
}

function isSharedCourse(course) {
  return ['duo', 'group'].includes(String(course.group_type || '').toLowerCase());
}

function sharedCourseSplit(course) {
  const enrolled = course.students?.length || 0;
  if (enrolled > 1) return enrolled;
  return String(course.group_type || '').toLowerCase() === 'duo' ? 2 : 5;
}

function defaultUnitPrice(course) {
  const minutes = Number(course.session_length_minutes || 60);

  if (
    isSharedCourse(course) &&
    course.price_per_person_per_60min !== null &&
    course.price_per_person_per_60min !== undefined
  ) {
    return Number(((Number(course.price_per_person_per_60min) * minutes) / 60).toFixed(2));
  }
  if (course.price_per_session !== null && course.price_per_session !== undefined) {
    const price = Number(course.price_per_session);
    return isSharedCourse(course) ? Number((price / sharedCourseSplit(course)).toFixed(2)) : price;
  }
  if (
    course.price_per_person_per_60min !== null &&
    course.price_per_person_per_60min !== undefined
  ) {
    return Number(((Number(course.price_per_person_per_60min) * minutes) / 60).toFixed(2));
  }
  return 0;
}

function priceUnitLabel(lang = 'de') {
  const minutes = Number(currentCourse?.session_length_minutes || 60);
  return lang === 'en' ? `Price per ${minutes}min CHF` : `Preis pro ${minutes}min CHF`;
}

async function loadNextInvoiceNumber() {
  try {
    const res = await apiFetch('/api/get-next-invoice-number');
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.invoice_number) throw new Error(body.error || 'Missing invoice number');
    return body.invoice_number;
  } catch (err) {
    console.error('Could not load next invoice number:', err);
    return '';
  }
}

function currentLang() {
  return document.querySelector('input[name="inv-language"]:checked')?.value || 'de';
}

function buildDefaultInvoiceData(invoiceNumber) {
  const today = new Date();
  const due = firstCourseDate(currentCourse) || addDays(today, 14);
  const quantity = courseQuantity(currentCourse);
  const unitPrice = defaultUnitPrice(currentCourse);
  const totalAmount = Number((quantity * unitPrice).toFixed(2));
  const courseCode = currentCourse.course_code || 'course';

  return {
    invoiceNumber,
    customerReference: currentStudent.customer_reference || '',
    invoiceDate: formatDateInput(today),
    dueDate: formatDateInput(due),
    subject: formalCourseLabel(currentCourse, currentLang()) || courseCode,
    quantity,
    unitPrice: unitPrice.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    email: billingEmail(currentStudent),
  };
}

function incrementInvoiceNumber(invoiceNumber, offset) {
  const match = String(invoiceNumber || '').match(/^(LWG-\d{4}-)(\d{4})$/);
  if (!match) return invoiceNumber;
  return `${match[1]}${String(Number(match[2]) + offset).padStart(4, '0')}`;
}

function updateTotalFromParts() {
  const total = numVal('inv-quantity') * numVal('inv-unit-price');
  setVal('inv-total', total ? total.toFixed(2) : '');
}

function handleQrFile(e) {
  const file = e.target.files?.[0];
  qrDataUrl = null;
  qrPdfBytes = null;
  qrFileType = null;
  revokeQrPdfObjectUrl();
  if (!file) {
    updateInvoicePreview();
    return;
  }
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    qrPdfObjectUrl = URL.createObjectURL(file);
    qrFileType = 'pdf';
    updateInvoicePreview();
    const reader = new FileReader();
    reader.onload = () => {
      qrPdfBytes = new Uint8Array(reader.result);
      updateInvoicePreview();
    };
    reader.onerror = () => {
      alert('Could not read the QR bill PDF.');
      e.target.value = '';
      qrPdfBytes = null;
      qrFileType = null;
      revokeQrPdfObjectUrl();
      updateInvoicePreview();
    };
    reader.readAsArrayBuffer(file);
    return;
  }
  if (!file.type.startsWith('image/')) {
    alert('Please upload the QR bill as a PDF, PNG, or JPG.');
    e.target.value = '';
    updateInvoicePreview();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    qrDataUrl = reader.result;
    qrFileType = 'image';
    updateInvoicePreview();
  };
  reader.onerror = () => {
    alert('Could not read the QR image.');
    e.target.value = '';
    updateInvoicePreview();
  };
  reader.readAsDataURL(file);
}

function getInvoiceData(student = currentStudent, invoiceNumber = val('inv-number')) {
  const language = document.querySelector('input[name="inv-language"]:checked')?.value || 'de';
  const quantity = numVal('inv-quantity');
  const unitPrice = numVal('inv-unit-price');
  const totalAmount = numVal('inv-total') || quantity * unitPrice;
  return {
    language,
    invoiceNumber,
    customerReference:
      currentBulkRecipients.length && student
        ? student.customer_reference || ''
        : val('inv-customer-reference'),
    invoiceDate: val('inv-date'),
    dueDate: val('inv-due-date'),
    subject: val('inv-subject'),
    quantity,
    unitPrice,
    totalAmount,
    currency: currentCourse?.currency || 'CHF',
    recipientName: billingName(student),
    recipientFirstName: student?.first_name || '',
    recipientLastName: student?.last_name || '',
    recipientGender: student?.gender || '',
    recipientGenderNote: student?.gender_note || '',
    recipientEmail: currentBulkRecipients.length
      ? billingEmail(student)
      : val('inv-recipient-email'),
    recipientLines: billingAddressLines(student),
    courseCode: currentCourse?.course_code || '',
  };
}

function chDate(value, lang = 'de') {
  if (!value) return '';
  const date = new Date(value + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return value;
  const locale = lang === 'en' ? 'en-GB' : 'de-CH';
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function longDate(value, lang = 'de') {
  if (!value) return '';
  const date = new Date(value + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return value;
  const locale = lang === 'en' ? 'en-GB' : 'de-CH';
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function invoiceStrings(lang, isGroup = false) {
  const isEN = lang === 'en';
  return {
    dateLabel: isEN ? 'Date:' : 'Auftrag vom:',
    invoiceNoLabel: isEN ? 'Invoice no.:' : 'Rechnungsnummer:',
    customerNoLabel: isEN ? 'Customer no.:' : 'Kundennummer:',
    vatLabel: isEN ? 'VAT no.:' : 'MWST-Nummer:',
    titleFallback: isEN ? 'Invoice' : 'Rechnung',
    colSubject: isEN ? 'Subject' : 'Fach',
    colLessons: isEN ? 'No. of lessons' : 'Anzahl Lektionen',
    colAmount: isEN ? 'Amount CHF' : 'Betrag CHF',
    paymentText: (dueDate) =>
      isEN
        ? `Please transfer the amount before the start of the course, at the latest by ${longDate(dueDate, 'en')}.`
        : `Wir bedanken uns für Ihre Überweisung vor Kursbeginn, spätestens jedoch bis zum ${chDate(dueDate, 'de')}.`,
    closing: isEN ? 'Kind regards,' : 'Herzliche Grüsse',
    footnote: isGroup
      ? isEN
        ? '*Once a group course is scheduled, individual lessons cannot be cancelled. Missed lessons are not refunded, credited toward another course, or converted to private lessons.'
        : '*Sobald ein Gruppenkurs geplant ist, können einzelne Lektionen nicht abgesagt werden. Versäumte Lektionen werden weder rückerstattet noch auf einen anderen Kurs angerechnet oder in Privatstunden umgewandelt.'
      : isEN
        ? '*Please note that cancelling or rescheduling a lesson must be communicated at least 24 hours before the lesson begins. If a lesson is cancelled less than 24 hours before it starts, the lesson is considered as held and cannot be rescheduled.'
        : '*Bitte beachte, dass das Absagen oder Verschieben einer Lektion mindestens 24 Stunden vor Lektionsbeginn kommuniziert werden muss. Wird eine Lektion weniger als 24 Stunden vor Beginn abgesagt, gilt sie als abgehalten und kann nicht mehr verschoben werden.',
  };
}

function buildPreviewHtml(data) {
  const lang = data.language || 'de';
  const s = invoiceStrings(lang, isSharedCourse(currentCourse));
  const recipient = data.recipientLines.map((line) => esc(line)).join('<br>');
  const greeting = formalGreeting(data);
  const qrPreview =
    qrFileType === 'pdf'
      ? `<span>${qrPdfBytes ? 'QR bill PDF will be attached as page 2' : 'Loading QR bill PDF...'}</span>`
      : qrDataUrl
        ? `<img src="${qrDataUrl}" alt="">`
        : '<span>QR bill PDF</span>';
  const qrPdfPreview =
    qrFileType === 'pdf' && qrPdfObjectUrl
      ? `<div class="inv-prev-pdf-page">
          <p class="inv-prev-pdf-label">QR bill page preview</p>
          <iframe src="${esc(qrPdfObjectUrl)}" title="QR bill PDF preview"></iframe>
        </div>`
      : '';
  return `
    <div class="inv-prev-page">
      <div class="inv-prev-sender">
        <p>${esc(SENDER.name)}</p>
        <p>${esc(SENDER.street)}</p>
        <p>${esc(SENDER.city)}</p>
        <p>Tel: ${esc(SENDER.phone)}</p>
        <p>Email: ${esc(SENDER.email)}</p>
      </div>
      <div class="inv-prev-meta">
        <p>${esc(s.dateLabel)} ${esc(chDate(data.invoiceDate, lang))}</p>
        <p>${esc(s.invoiceNoLabel)} ${esc(data.invoiceNumber)}</p>
        <p>${esc(s.customerNoLabel)} ${esc(data.customerReference || '—')}</p>
        <p>${esc(s.vatLabel)} ${esc(SENDER.vat)}</p>
        <p>Amount: CHF ${esc(money(data.totalAmount))}</p>
      </div>
      <p class="inv-prev-date">${esc(longDate(data.invoiceDate, lang))}</p>
      <h3>${esc(data.subject || s.titleFallback)}</h3>
      <p class="inv-prev-greeting">${esc(greeting)}</p>
      <div class="inv-prev-address">${recipient}</div>
      <table>
        <colgroup>
          <col style="width:33.5%">
          <col style="width:22.5%">
          <col style="width:29.5%">
          <col style="width:14.5%">
        </colgroup>
        <thead>
          <tr>
            <th>${esc(s.colSubject)}</th>
            <th>${esc(s.colLessons)}</th>
            <th>${esc(priceUnitLabel(lang))}</th>
            <th>${esc(s.colAmount)}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${esc(data.subject)}</td>
            <td>${esc(String(data.quantity))}</td>
            <td>${esc(money(data.unitPrice))}</td>
            <td>${esc(money(data.totalAmount))}</td>
          </tr>
          <tr>
            <td colspan="3"><strong>Total CHF</strong></td>
            <td><strong>${esc(money(data.totalAmount))}</strong></td>
          </tr>
        </tbody>
      </table>
      <p>${esc(s.paymentText(data.dueDate))}</p>
      <p>${esc(s.closing)}<br>Gioia Birukoff</p>
      <div class="inv-prev-qr">
        ${qrPreview}
      </div>
      <p class="inv-prev-note">${esc(s.footnote)}</p>
    </div>
    ${qrPdfPreview}`;
}

function updateInvoicePreview() {
  const container = document.getElementById('invoice-preview');
  if (!container || !currentCourse || !currentStudent) return;
  container.innerHTML = buildPreviewHtml(getInvoiceData());
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(String(text || ''), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

async function mergeWithQrPdf(invoiceBytes) {
  if (!qrPdfBytes) return arrayBufferToBase64(invoiceBytes);
  if (!window.PDFLib?.PDFDocument) {
    throw new Error('PDF merge library not loaded — please reload the page.');
  }
  const invoiceDoc = await window.PDFLib.PDFDocument.load(invoiceBytes);
  const qrDoc = await window.PDFLib.PDFDocument.load(qrPdfBytes);
  const copiedPages = await invoiceDoc.copyPages(qrDoc, qrDoc.getPageIndices());
  copiedPages.forEach((page) => invoiceDoc.addPage(page));
  return await invoiceDoc.saveAsBase64({ dataUri: false });
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function buildInvoicePdf(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 22;
  const contentW = pageW - margin * 2;

  const setFont = (size, style = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  };
  const textRight = (text, x, y) => doc.text(String(text || ''), x, y, { align: 'right' });
  const drawLabelValue = (label, value, x, y, valueX) => {
    setFont(8.5, 'bold');
    doc.text(label, x, y);
    setFont(8.5);
    doc.text(String(value || '-'), valueX, y);
  };

  setFont(9.5);
  doc.text(SENDER.name, margin, 24);
  doc.text(SENDER.street, margin, 29);
  doc.text(SENDER.city, margin, 34);
  doc.text(`Tel: ${SENDER.phone}`, margin, 44);
  doc.text(`Email: ${SENDER.email}`, margin, 49);

  const lang = data.language || 'de';
  const s = invoiceStrings(lang, isSharedCourse(currentCourse));

  let y = 66;
  drawLabelValue(s.dateLabel, chDate(data.invoiceDate, lang), margin, y, margin + 24);
  drawLabelValue(s.invoiceNoLabel, data.invoiceNumber, margin + 72, y, margin + 106);
  y += 6;
  drawLabelValue(s.customerNoLabel, data.customerReference || '-', margin, y, margin + 26);
  drawLabelValue(s.vatLabel, SENDER.vat, margin + 72, y, margin + 100);
  y += 6;
  drawLabelValue('Amount:', `CHF ${money(data.totalAmount)}`, margin, y, margin + 18);

  y = 94;
  setFont(7);
  doc.text(`${SENDER.name} ${SENDER.street} ${SENDER.city}`, margin, y);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.15);
  doc.line(margin, y + 1.8, margin + 76, y + 1.8);

  setFont(10.5);
  y += 10;
  data.recipientLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 5.8;
  });

  y = Math.max(y + 18, 136);
  setFont(11);
  doc.text(longDate(data.invoiceDate, lang), margin, y);

  y += 14;
  setFont(19, 'bold');
  const titleLines = doc.splitTextToSize(data.subject || s.titleFallback, contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 7;

  setFont(10.5);
  doc.text(formalGreeting(data), margin, y);

  y += 18;
  const tableTop = y;
  const widths = [56, 39, 50, 25];
  const xs = [
    margin,
    margin + widths[0],
    margin + widths[0] + widths[1],
    margin + widths[0] + widths[1] + widths[2],
  ];
  const tableW = widths.reduce((a, b) => a + b, 0);
  const headerH = 13;
  const subjectLines = doc.splitTextToSize(String(data.subject || ''), widths[0] - 5);
  const itemH = Math.max(14, subjectLines.length * 5.2 + 6);
  const totalH = 13;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  setFont(9, 'bold');
  [s.colSubject, s.colLessons, priceUnitLabel(lang), s.colAmount].forEach((label, i) => {
    doc.rect(xs[i], tableTop, widths[i], headerH);
    const headerLines = doc.splitTextToSize(label, widths[i] - 4);
    doc.text(headerLines, xs[i] + 2, tableTop + 5.2);
  });

  const itemTop = tableTop + headerH;
  setFont(9);
  doc.rect(margin, itemTop, tableW, itemH);
  doc.line(xs[1], itemTop, xs[1], itemTop + itemH);
  doc.line(xs[2], itemTop, xs[2], itemTop + itemH);
  doc.line(xs[3], itemTop, xs[3], itemTop + itemH);
  doc.text(subjectLines, xs[0] + 2, itemTop + 7);
  textRight(data.quantity, xs[1] + widths[1] - 3, itemTop + 8);
  textRight(money(data.unitPrice), xs[2] + widths[2] - 3, itemTop + 8);
  textRight(money(data.totalAmount), xs[3] + widths[3] - 3, itemTop + 8);

  const totalTop = itemTop + itemH;
  doc.rect(margin, totalTop, tableW, totalH);
  doc.line(xs[3], totalTop, xs[3], totalTop + totalH);
  setFont(9, 'bold');
  doc.text('Total CHF', xs[0] + 2, totalTop + 8);
  textRight(money(data.totalAmount), xs[3] + widths[3] - 3, totalTop + 8);

  y = totalTop + totalH + 18;
  setFont(10.5);
  y = addWrappedText(doc, s.paymentText(data.dueDate), margin, y, contentW, 5.5);
  y += 10;
  doc.text(s.closing, margin, y);
  doc.text('Gioia Birukoff', margin, y + 6);

  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, undefined, pageW - margin - 70, pageH - 62, 70, 42);
    } catch (err) {
      console.error('Could not add QR image:', err);
    }
  }

  setFont(7.2);
  addWrappedText(doc, s.footnote, margin, pageH - 22, contentW, 3.6);

  return await mergeWithQrPdf(doc.output('arraybuffer'));
}

export async function submitInvoice() {
  const btn = document.getElementById('inv-submit');
  const msg = document.getElementById('inv-msg');
  msg.style.display = 'none';

  const data = getInvoiceData();
  const isBulk = currentBulkRecipients.length > 0;
  const bulkRecipients = isBulk ? selectedBulkRecipients() : [];
  if (isBulk && !bulkRecipients.length) {
    msg.textContent = 'Select at least one recipient.';
    msg.className = 'modal-msg err';
    msg.style.display = 'block';
    return;
  }
  if (!data.invoiceNumber || !data.recipientEmail || !data.totalAmount) {
    msg.textContent = 'Please fill invoice number, email, and amount.';
    msg.className = 'modal-msg err';
    msg.style.display = 'block';
    return;
  }
  if (qrFileType === 'pdf' && !qrPdfBytes) {
    msg.textContent = 'The QR bill PDF is still loading. Please wait a moment.';
    msg.className = 'modal-msg err';
    msg.style.display = 'block';
    return;
  }
  if (
    !qrDataUrl &&
    !qrPdfBytes &&
    !confirm('No QR bill has been uploaded. Send the invoice without it?')
  ) {
    return;
  }

  btn.textContent = 'preparing pdf…';
  btn.disabled = true;

  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('PDF library not loaded — please reload the page.');
    }
    if (isBulk) {
      const invoiceNumberPattern = /^(LWG-\d{4}-)(\d{4})$/;
      if (!invoiceNumberPattern.test(data.invoiceNumber)) {
        throw new Error('Invoice number must use the format LWG-YYYY-0001.');
      }

      let sent = 0;
      const failed = [];
      for (let i = 0; i < bulkRecipients.length; i += 1) {
        const student = bulkRecipients[i];
        const invoiceNumber = incrementInvoiceNumber(data.invoiceNumber, i);
        const studentData = getInvoiceData(student, invoiceNumber);
        btn.textContent = `sending ${i + 1}/${bulkRecipients.length}…`;
        const pdfBase64 = await buildInvoicePdf(studentData);
        try {
          await sendInvoiceRequest(studentData, student, pdfBase64);
          sent += 1;
          const rowMsg = document.getElementById(`invoice-msg-${currentCourse.id}-${student.id}`);
          if (rowMsg) showMessage(rowMsg, 'sent');
        } catch (err) {
          failed.push(`${studentName(student)}: ${err.message || err}`);
        }
      }

      msg.textContent = failed.length
        ? `Sent ${sent}; failed ${failed.length}. ${failed.join(' | ')}`
        : `Sent ${sent} invoices.`;
      msg.className = failed.length ? 'modal-msg err' : 'modal-msg success';
      msg.style.display = 'block';
      btn.textContent = failed.length ? 'send invoices' : 'sent';
      btn.disabled = failed.length ? false : true;
      if (failed.length) updateBulkInvoiceCount();
      if (!failed.length) setTimeout(() => closeInvoiceModal(), MESSAGE_TIMEOUT_MS);
      return;
    }

    const pdfBase64 = await buildInvoicePdf(data);
    btn.textContent = 'sending…';
    await sendInvoiceRequest(data, currentStudent, pdfBase64);

    const rowMsg = document.getElementById(`invoice-msg-${currentCourse.id}-${currentStudent.id}`);
    if (rowMsg) showMessage(rowMsg, 'sent');
    msg.textContent = 'Invoice sent.';
    msg.className = 'modal-msg success';
    msg.style.display = 'block';
    btn.textContent = 'sent';
    setTimeout(() => closeInvoiceModal(), MESSAGE_TIMEOUT_MS);
  } catch (err) {
    msg.textContent = 'Error: ' + (err.message || err);
    msg.className = 'modal-msg err';
    msg.style.display = 'block';
    btn.textContent = isBulk ? 'send invoices' : 'send invoice';
    btn.disabled = false;
  }
}

async function sendInvoiceRequest(data, student, pdfBase64) {
  const res = await apiFetch('/api/send-invoice', {
    method: 'POST',
    body: {
      student_id: student.id,
      course_id: currentCourse.id,
      email: data.recipientEmail,
      name: data.recipientName,
      first_name: data.recipientFirstName,
      last_name: data.recipientLastName,
      gender: data.recipientGender,
      gender_note: data.recipientGenderNote,
      language: data.language,
      invoice: {
        invoice_number: data.invoiceNumber,
        customer_reference: data.customerReference,
        subject: data.subject,
        quantity: data.quantity,
        unit_price: data.unitPrice,
        total_amount: data.totalAmount,
        currency: data.currency,
        invoice_date: data.invoiceDate,
        due_date: data.dueDate,
      },
      pdf_base64: pdfBase64,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}
