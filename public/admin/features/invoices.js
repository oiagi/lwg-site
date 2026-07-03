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
let bulkPreviewIndex = 0;
let _singleOpenQuantity = null;
const sharedQrAttachment = createQrAttachment();

function createQrAttachment() {
  return {
    dataUrl: null,
    pdfBytes: null,
    fileType: null,
    pdfObjectUrl: null,
    fileName: '',
  };
}

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
  resetSharedQrAttachment();

  const titleEl = document.getElementById('invoice-title');
  titleEl.textContent = `send invoice — ${studentName(student)}`;
  renderBulkInvoiceRecipients([]);

  const msg = document.getElementById('inv-msg');
  msg.classList.remove('is-visible-block');
  msg.textContent = '';
  const btn = document.getElementById('inv-submit');
  btn.textContent = 'send invoice';
  btn.disabled = false;

  document.getElementById('inv-quantity').disabled = false;
  document.getElementById('inv-total').disabled = false;
  _singleOpenQuantity = studentLessonCount(student);
  const data = buildDefaultInvoiceData('', student);
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
  resetDownloadButton('download');

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

function resetDownloadButton(label) {
  const dlBtn = document.getElementById('inv-download');
  if (!dlBtn) return;
  dlBtn.textContent = label;
  dlBtn.disabled = false;
}

export async function openBulkInvoiceModal(courseId, coursesCache) {
  const course = coursesCache.find((c) => String(c.id) === String(courseId));
  if (!course) {
    alert('Course not found. Please reload and try again.');
    return;
  }

  const recipients = (course.students || []).filter((s) => s.email || s.billing_email);

  if (!recipients.length) {
    alert('No students with email addresses were found for this course.');
    return;
  }

  currentCourse = course;
  currentStudent = recipients[0];
  bulkPreviewIndex = 0;
  currentBulkRecipients = recipients.map((s) => {
    const alreadyInvoiced = Boolean(
      (s.open_invoices || []).length || (s.paid_invoices || []).length
    );
    return {
      ...s,
      selected: !alreadyInvoiced,
      alreadyInvoiced,
      _originalLessonCount: s.invoice_lesson_count,
      _invoiceNumber: null,
      qrAttachment: createQrAttachment(),
    };
  });
  resetSharedQrAttachment();

  const titleEl = document.getElementById('invoice-title');
  titleEl.textContent = `send invoices — ${course.course_code || 'course'}`;

  const msg = document.getElementById('inv-msg');
  msg.classList.remove('is-visible-block');
  msg.textContent = '';
  const btn = document.getElementById('inv-submit');
  btn.textContent = `send ${currentBulkRecipients.length} invoices`;
  btn.disabled = false;

  document.getElementById('inv-quantity').disabled = true;
  document.getElementById('inv-total').disabled = true;
  const data = buildDefaultInvoiceData('', currentStudent);
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

  renderBulkInvoiceRecipients(currentBulkRecipients);
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
  document.getElementById('inv-quantity').disabled = false;
  document.getElementById('inv-total').disabled = false;
  resetBulkQrAttachments();
  currentBulkRecipients = [];
  renderBulkInvoiceRecipients([]);
  resetSharedQrAttachment();
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

function revokeQrAttachmentObjectUrl(attachment) {
  if (!attachment?.pdfObjectUrl) return;
  URL.revokeObjectURL(attachment.pdfObjectUrl);
  attachment.pdfObjectUrl = null;
}

function clearQrAttachment(attachment) {
  if (!attachment) return;
  revokeQrAttachmentObjectUrl(attachment);
  attachment.dataUrl = null;
  attachment.pdfBytes = null;
  attachment.fileType = null;
  attachment.fileName = '';
}

function resetSharedQrAttachment() {
  clearQrAttachment(sharedQrAttachment);
}

function resetBulkQrAttachments() {
  currentBulkRecipients.forEach((recipient) => clearQrAttachment(recipient.qrAttachment));
}

function hasQrAttachment(attachment) {
  return Boolean(attachment?.dataUrl || attachment?.pdfBytes);
}

function activeQrAttachment(student = currentStudent) {
  if (currentBulkRecipients.length && student?.qrAttachment?.fileType) {
    return student.qrAttachment;
  }
  return sharedQrAttachment;
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

function billingEmail(student) {
  return student.billing_email || student.email || '';
}

function hasBillingAddressData(student) {
  return Boolean(
    student?.billing_name ||
    student?.billing_street ||
    student?.billing_street_number ||
    student?.billing_postcode ||
    student?.billing_city
  );
}

function splitName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function fullNameFromParts(firstName, lastName, fallbackName = '') {
  return [firstName, lastName].filter(Boolean).join(' ') || fallbackName;
}

function invoiceRecipient(student) {
  if (hasBillingAddressData(student)) {
    const name = student.billing_name || '';
    const { firstName, lastName } = splitName(name);
    return {
      name,
      firstName,
      lastName,
      gender: student.billing_gender || student.gender || '',
      genderNote: student.billing_gender_note || '',
      email: student.billing_email || '',
      street: [student.billing_street, student.billing_street_number].filter(Boolean).join(' '),
      city: [student.billing_postcode, student.billing_city].filter(Boolean).join(' '),
    };
  }

  return {
    name: studentName(student),
    firstName: student?.first_name || '',
    lastName: student?.last_name || '',
    gender: student?.gender || '',
    genderNote: student?.gender_note || '',
    email: student?.email || '',
    street: [student?.street, student?.street_number].filter(Boolean).join(' '),
    city: [student?.postcode, student?.city].filter(Boolean).join(' '),
  };
}

function billingAddressLines(student) {
  const recipient = invoiceRecipient(student);
  return [recipient.name, recipient.street, recipient.city].filter(Boolean);
}

function formalGreeting(data) {
  const lastName = data.recipientLastName || splitName(data.recipientName).lastName || '';
  const fullName = fullNameFromParts(
    data.recipientFirstName,
    data.recipientLastName,
    data.recipientName
  );
  if (data.language === 'en') {
    return fullName ? `Dear ${fullName},` : 'Dear Sir or Madam,';
  }
  if (data.recipientGender === 'female' && lastName) return `Liebe Frau ${lastName}`;
  if (data.recipientGender === 'male' && lastName) return `Lieber Herr ${lastName}`;
  return fullName ? `Guten Tag ${fullName}` : 'Guten Tag';
}

function renderBulkInvoiceRecipients(recipients) {
  const wrap = document.getElementById('inv-bulk-recipients');
  if (!wrap) return;
  if (!recipients.length) {
    wrap.classList.add('is-hidden');
    wrap.innerHTML = '';
    return;
  }
  const hasAlreadyInvoiced = recipients.some((s) => s.alreadyInvoiced);
  const alreadyInvoicedHint = hasAlreadyInvoiced
    ? '<p class="label-hint">Students who already have an invoice for this course are unchecked by default — check them to preview, download, or send again.</p>'
    : '';
  wrap.classList.remove('is-hidden');
  wrap.innerHTML = `
    <label>Recipients <span class="cs-meta" id="inv-bulk-count"></span></label>
    <p class="label-hint">Upload an individual QR pay part for a recipient, or use the shared Bank QR bill below as a fallback.</p>
    <div class="invoice-recipient-list">
      ${recipients
        .map(
          (s, i) => `
            <div class="invoice-recipient-row">
              <input type="checkbox" data-invoice-recipient="${i}" ${s.selected ? 'checked' : ''}>
              <span class="invoice-recipient-person">
                <span class="invoice-recipient-name">${esc(studentName(s))}${
                  s.alreadyInvoiced
                    ? ' <span class="invoice-recipient-flag">already invoiced</span>'
                    : ''
                }</span>
                <span class="invoice-recipient-email">${esc(billingEmail(s))}</span>
                <input class="invoice-recipient-lessons" type="number" min="1" step="1"
                  value="${esc(String(studentLessonCount(s)))}"
                  data-invoice-recipient-lessons="${i}"
                  aria-label="Lessons for ${esc(studentName(s))}">
              </span>
              <input class="invoice-recipient-qr" type="file" data-invoice-recipient-qr="${i}" accept="application/pdf,image/png,image/jpeg,image/webp" aria-label="QR pay part for ${esc(
                studentName(s)
              )}">
              <span class="invoice-recipient-qr-status" data-invoice-recipient-qr-status="${i}">shared QR</span>
            </div>`
        )
        .join('')}
    </div>
    ${alreadyInvoicedHint}`;

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
  wrap.querySelectorAll('input[data-invoice-recipient-qr]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(input.dataset.invoiceRecipientQr, 10);
      handleRecipientQrFile(idx, e);
    });
  });
  wrap.querySelectorAll('input[data-invoice-recipient-lessons]').forEach((input) => {
    input.addEventListener('change', () => {
      const idx = parseInt(input.dataset.invoiceRecipientLessons, 10);
      if (currentBulkRecipients[idx]) {
        currentBulkRecipients[idx].invoice_lesson_count = input.value ? Number(input.value) : null;
        syncBulkInvoicePreviewRecipient();
        updateInvoicePreview();
      }
    });
  });
  updateAllRecipientQrStatuses();
}

function selectedBulkRecipients() {
  return currentBulkRecipients.filter((s) => s.selected);
}

function syncBulkInvoicePreviewRecipient() {
  const selected = selectedBulkRecipients();
  if (bulkPreviewIndex >= selected.length) bulkPreviewIndex = Math.max(0, selected.length - 1);
}

function updateBulkInvoiceCount() {
  const selected = selectedBulkRecipients().length;
  const countEl = document.getElementById('inv-bulk-count');
  if (countEl) countEl.textContent = `(${selected} selected)`;
  if (!currentBulkRecipients.length) return;
  const btn = document.getElementById('inv-submit');
  if (btn) {
    btn.disabled = selected === 0;
    btn.textContent = selected === 1 ? 'send 1 invoice' : `send ${selected} invoices`;
  }
  const dlBtn = document.getElementById('inv-download');
  if (dlBtn) {
    dlBtn.disabled = selected === 0;
    dlBtn.textContent = selected === 1 ? 'download 1' : `download ${selected}`;
  }
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
  return Number(course?.sessions_total || course?.sessions?.length || 1);
}

function studentLessonCount(student, course = currentCourse) {
  const override = Number(student?.invoice_lesson_count);
  if (Number.isFinite(override) && override > 0) return override;
  if (student?.joined_at && course?.sessions?.length) {
    const joined = new Date(student.joined_at + 'T00:00:00');
    if (!Number.isNaN(joined.getTime())) {
      const count = course.sessions.filter(
        (s) => s.status !== 'cancelled' && new Date(s.scheduled_at) >= joined
      ).length;
      if (count > 0) return count;
    }
  }
  return courseQuantity(course);
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

function orderDate(student) {
  if (student?.joined_at) {
    const d = new Date(student.joined_at + 'T00:00:00');
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (currentCourse?.created_at) {
    const d = new Date(currentCourse.created_at);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function buildDefaultInvoiceData(invoiceNumber, student = currentStudent) {
  const today = new Date();
  const due = firstCourseDate(currentCourse) || addDays(today, 14);
  const quantity = studentLessonCount(student);
  const unitPrice = defaultUnitPrice(currentCourse);
  const totalAmount = Number((quantity * unitPrice).toFixed(2));
  const courseCode = currentCourse.course_code || 'course';

  return {
    invoiceNumber,
    customerReference: student?.customer_reference || '',
    invoiceDate: formatDateInput(orderDate(student)),
    dueDate: formatDateInput(due),
    subject: formalCourseLabel(currentCourse, currentLang()) || courseCode,
    quantity,
    unitPrice: unitPrice.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    email: billingEmail(student),
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

function updateRecipientQrStatus(index) {
  const recipient = currentBulkRecipients[index];
  const status = document.querySelector(`[data-invoice-recipient-qr-status="${index}"]`);
  if (!recipient || !status) return;
  const attachment = recipient.qrAttachment;
  if (attachment?.fileType === 'pdf' && !attachment.pdfBytes) {
    status.textContent = 'loading QR';
    return;
  }
  if (sharedQrAttachment.fileType === 'pdf' && !sharedQrAttachment.pdfBytes) {
    status.textContent = 'loading shared QR';
    return;
  }
  status.textContent = hasQrAttachment(attachment)
    ? 'individual QR'
    : sharedQrAttachment.fileType
      ? 'shared QR'
      : 'no QR';
}

function updateAllRecipientQrStatuses() {
  currentBulkRecipients.forEach((_, index) => updateRecipientQrStatus(index));
}

function readQrFile(file, attachment, inputEl, onChange) {
  clearQrAttachment(attachment);
  if (!file) {
    onChange?.();
    return;
  }
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    attachment.pdfObjectUrl = URL.createObjectURL(file);
    attachment.fileType = 'pdf';
    attachment.fileName = file.name;
    onChange?.();
    const reader = new FileReader();
    reader.onload = () => {
      attachment.pdfBytes = new Uint8Array(reader.result);
      onChange?.();
    };
    reader.onerror = () => {
      alert('Could not read the QR bill PDF.');
      if (inputEl) inputEl.value = '';
      clearQrAttachment(attachment);
      onChange?.();
    };
    reader.readAsArrayBuffer(file);
    return;
  }
  if (!file.type.startsWith('image/')) {
    alert('Please upload the QR bill as a PDF, PNG, or JPG.');
    if (inputEl) inputEl.value = '';
    onChange?.();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    attachment.dataUrl = reader.result;
    attachment.fileType = 'image';
    attachment.fileName = file.name;
    onChange?.();
  };
  reader.onerror = () => {
    alert('Could not read the QR image.');
    if (inputEl) inputEl.value = '';
    clearQrAttachment(attachment);
    onChange?.();
  };
  reader.readAsDataURL(file);
}

function handleQrFile(e) {
  readQrFile(e.target.files?.[0], sharedQrAttachment, e.target, () => {
    updateAllRecipientQrStatuses();
    updateInvoicePreview();
  });
}

function handleRecipientQrFile(index, e) {
  const recipient = currentBulkRecipients[index];
  if (!recipient) return;
  recipient.qrAttachment ||= createQrAttachment();
  readQrFile(e.target.files?.[0], recipient.qrAttachment, e.target, () => {
    updateRecipientQrStatus(index);
    if (String(currentStudent?.id) === String(recipient.id)) updateInvoicePreview();
  });
}

function getInvoiceData(student = currentStudent, invoiceNumber = val('inv-number')) {
  const language = document.querySelector('input[name="inv-language"]:checked')?.value || 'de';
  const isBulk = currentBulkRecipients.length > 0;
  const quantity = isBulk ? studentLessonCount(student) : numVal('inv-quantity');
  const unitPrice = numVal('inv-unit-price');
  const totalAmount = isBulk ? quantity * unitPrice : numVal('inv-total') || quantity * unitPrice;
  const recipient = invoiceRecipient(student);
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
    recipientName: recipient.name,
    recipientFirstName: recipient.firstName,
    recipientLastName: recipient.lastName,
    recipientGender: recipient.gender,
    recipientGenderNote: recipient.genderNote,
    recipientEmail: currentBulkRecipients.length
      ? recipient.email || billingEmail(student)
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
    classType: isGroup
      ? isEN
        ? 'Group lessons'
        : 'Gruppenunterricht'
      : isEN
        ? 'Individual lessons'
        : 'Individualunterricht',
    colSubject: isEN ? 'Subject' : 'Fach',
    colLessons: isEN ? 'No. of lessons' : 'Anzahl Lektionen',
    colAmount: isEN ? 'Amount CHF' : 'Betrag CHF',
    paymentText: () =>
      isEN
        ? 'Please transfer the amount before the start of the course, at the latest within 30 days.'
        : 'Wir bedanken uns für Ihre Überweisung vor Kursbeginn, spätestens jedoch innerhalb von 30 Tagen.',
    closing: isEN ? 'Kind regards,' : 'Herzliche Grüsse',
    footnote: isGroup
      ? isEN
        ? '*Once a group course is scheduled, individual lessons cannot be cancelled. Missed lessons are not refunded, credited toward another course, or converted to private lessons.'
        : '*Sobald ein Gruppenkurs geplant ist, können einzelne Lektionen nicht mehr abgesagt werden. Versäumte Lektionen werden weder rückerstattet noch für einen anderen Kurs angerechnet oder in Privatstunden umgewandelt.'
      : isEN
        ? '*Please note that cancelling or rescheduling a lesson must be communicated at least 24 hours before the lesson begins. If a lesson is cancelled less than 24 hours before it starts, the lesson is considered as held and cannot be rescheduled.'
        : '*Bitte beachten Sie, dass das Absagen oder Verschieben einer Lektion mindestens 24 Stunden vor Lektionsbeginn kommuniziert werden muss. Wird eine Lektion weniger als 24 Stunden vor Beginn abgesagt, gilt sie als abgehalten und kann nicht mehr verschoben werden.',
  };
}

function buildPreviewHtml(data) {
  const lang = data.language || 'de';
  const s = invoiceStrings(lang, isSharedCourse(currentCourse));
  const recipient = data.recipientLines.map((line) => esc(line)).join('<br>');
  const greeting = formalGreeting(data);
  const qrAttachment = activeQrAttachment(currentStudent);
  const qrPreview =
    qrAttachment.fileType === 'pdf'
      ? `<span>${qrAttachment.pdfBytes ? 'QR payment part will be placed at the bottom of this page (page 2 if it does not fit)' : 'Loading QR bill PDF...'}</span>`
      : qrAttachment.dataUrl
        ? `<img src="${qrAttachment.dataUrl}" alt="">`
        : '<span>QR bill PDF</span>';
  const qrPdfPreview =
    qrAttachment.fileType === 'pdf' && qrAttachment.pdfObjectUrl
      ? `<div class="inv-prev-pdf-page">
          <p class="inv-prev-pdf-label">QR bill page preview</p>
          <iframe src="${esc(qrAttachment.pdfObjectUrl)}" title="QR bill PDF preview"></iframe>
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
      <div class="inv-prev-details">
        <div class="inv-prev-meta">
          <p>${esc(s.dateLabel)} ${esc(chDate(data.invoiceDate, lang))}</p>
          <p>${esc(s.invoiceNoLabel)} ${esc(data.invoiceNumber)}</p>
          <p>${esc(s.customerNoLabel)} ${esc(data.customerReference || '—')}</p>
          <p>${esc(s.vatLabel)} ${esc(SENDER.vat)}</p>
          <p>Amount: CHF ${esc(money(data.totalAmount))}</p>
        </div>
        <div class="inv-prev-address">
          <p class="inv-prev-address-sender">${esc(SENDER.name)} ${esc(SENDER.street)} ${esc(SENDER.city)}</p>
          <div>${recipient}</div>
        </div>
      </div>
      <p class="inv-prev-date">${esc(longDate(data.invoiceDate, lang))}</p>
      <h3>${esc(data.subject || s.titleFallback)}</h3>
      <p class="inv-prev-greeting">${esc(greeting)}</p>
      <table>
        <colgroup>
          <col class="invoice-col-subject">
          <col class="invoice-col-lessons">
          <col class="invoice-col-unit">
          <col class="invoice-col-amount">
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
            <td>${esc(data.subject)}<br><em>${esc(s.classType)}</em></td>
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
      <p>${esc(s.paymentText())}</p>
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
  if (!container || !currentCourse) return;
  const selected = selectedBulkRecipients();
  if (currentBulkRecipients.length) {
    if (!selected.length) {
      container.innerHTML = '';
      return;
    }
    if (bulkPreviewIndex >= selected.length) bulkPreviewIndex = selected.length - 1;
    const student = selected[bulkPreviewIndex];
    currentStudent = student;
    setVal('inv-recipient-email', billingEmail(student));
    const data = getInvoiceData(student);
    setVal('inv-quantity', data.quantity);
    setVal('inv-total', money(data.totalAmount));
    const canPrev = bulkPreviewIndex > 0;
    const canNext = bulkPreviewIndex < selected.length - 1;
    container.innerHTML = `
      <div class="invoice-carousel-nav">
        <button class="invoice-carousel-btn" data-action="prevBulkPreview"${canPrev ? '' : ' disabled'} aria-label="Previous">&#8249;</button>
        <span class="invoice-carousel-counter">${bulkPreviewIndex + 1} / ${selected.length} &mdash; ${esc(studentName(student))}</span>
        <button class="invoice-carousel-btn" data-action="nextBulkPreview"${canNext ? '' : ' disabled'} aria-label="Next">&#8250;</button>
      </div>
      ${buildPreviewHtml(data)}`;
  } else {
    if (!currentStudent) return;
    container.innerHTML = buildPreviewHtml(getInvoiceData());
  }
}

export function prevBulkPreview() {
  if (bulkPreviewIndex > 0) {
    bulkPreviewIndex--;
    updateInvoicePreview();
  }
}

export function nextBulkPreview() {
  if (bulkPreviewIndex < selectedBulkRecipients().length - 1) {
    bulkPreviewIndex++;
    updateInvoicePreview();
  }
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(String(text || ''), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

// Swiss QR payment part: full page width, exactly 105mm tall, at the bottom edge.
const QR_PART_HEIGHT_MM = 105;
const MM_TO_PT = 72 / 25.4;

async function mergeWithQrPdf(
  invoiceBytes,
  qrAttachment = sharedQrAttachment,
  qrOnFirstPage = false
) {
  if (!qrAttachment?.pdfBytes) return arrayBufferToBase64(invoiceBytes);
  if (!window.PDFLib?.PDFDocument) {
    throw new Error('PDF merge library not loaded — please reload the page.');
  }
  const invoiceDoc = await window.PDFLib.PDFDocument.load(invoiceBytes);
  const qrDoc = await window.PDFLib.PDFDocument.load(qrAttachment.pdfBytes);
  if (qrOnFirstPage && qrDoc.getPageCount() === 1) {
    // Crop the bottom 105mm of the bank's PDF (the payment part — the rest is
    // letterhead) and stamp it onto the bottom of the invoice page.
    const [qrPage] = qrDoc.getPages();
    const cropHeight = Math.min(qrPage.getHeight(), QR_PART_HEIGHT_MM * MM_TO_PT);
    const embedded = await invoiceDoc.embedPage(qrPage, {
      left: 0,
      bottom: 0,
      right: qrPage.getWidth(),
      top: cropHeight,
    });
    const firstPage = invoiceDoc.getPage(0);
    const scale = firstPage.getWidth() / embedded.width;
    firstPage.drawPage(embedded, { x: 0, y: 0, xScale: scale, yScale: scale });
    return await invoiceDoc.saveAsBase64({ dataUri: false });
  }
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

async function buildInvoicePdf(data, qrAttachment = activeQrAttachment()) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const margin = 22;
  const contentW = pageW - margin * 2;
  const addressW = 76;
  const addressX = pageW - margin - addressW;

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

  let y = 56;
  const metaStartY = y;
  drawLabelValue(s.dateLabel, chDate(data.invoiceDate, lang), margin, y, margin + 24);
  y += 6;
  drawLabelValue(s.invoiceNoLabel, data.invoiceNumber, margin, y, margin + 31);
  y += 6;
  drawLabelValue(s.customerNoLabel, data.customerReference || '-', margin, y, margin + 29);
  y += 6;
  drawLabelValue(s.vatLabel, SENDER.vat, margin, y, margin + 27);
  y += 6;
  drawLabelValue('Amount:', `CHF ${money(data.totalAmount)}`, margin, y, margin + 18);
  const metaEndY = y;

  y = metaStartY;
  setFont(7);
  doc.text(`${SENDER.name} ${SENDER.street} ${SENDER.city}`, addressX, y);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.15);
  doc.line(addressX, y + 2.6, addressX + addressW, y + 2.6);

  setFont(10.5);
  y += 10;
  data.recipientLines.forEach((line) => {
    const lines = doc.splitTextToSize(String(line || ''), addressW);
    doc.text(lines, addressX, y);
    y += lines.length * 5.8;
  });
  const addressEndY = y;

  y = Math.max(metaEndY, addressEndY) + 8;
  setFont(11);
  doc.text(longDate(data.invoiceDate, lang), margin, y);

  y += 9;
  setFont(19, 'bold');
  const titleLines = doc.splitTextToSize(data.subject || s.titleFallback, contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 6;

  setFont(10.5);
  doc.text(formalGreeting(data), margin, y);

  y += 8;
  const tableTop = y;
  const widths = [56, 39, 50, 25];
  const xs = [
    margin,
    margin + widths[0],
    margin + widths[0] + widths[1],
    margin + widths[0] + widths[1] + widths[2],
  ];
  const tableW = widths.reduce((a, b) => a + b, 0);
  const headerH = 7;
  const subjectLines = doc.splitTextToSize(String(data.subject || ''), widths[0] - 5);
  const classTypeLines = doc.splitTextToSize(s.classType, widths[0] - 5);
  const itemLineH = 3.7; // jsPDF line spacing at 9pt
  const classTypeOffset = 5.5 + subjectLines.length * itemLineH + 0.5;
  const itemH = Math.max(8, classTypeOffset + (classTypeLines.length - 1) * itemLineH + 3.5);
  const totalH = 7;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  setFont(9, 'bold');
  [s.colSubject, s.colLessons, priceUnitLabel(lang), s.colAmount].forEach((label, i) => {
    doc.rect(xs[i], tableTop, widths[i], headerH);
    const headerLines = doc.splitTextToSize(label, widths[i] - 4);
    doc.text(headerLines, xs[i] + 2, tableTop + 4.5);
  });

  const itemTop = tableTop + headerH;
  setFont(9);
  doc.rect(margin, itemTop, tableW, itemH);
  doc.line(xs[1], itemTop, xs[1], itemTop + itemH);
  doc.line(xs[2], itemTop, xs[2], itemTop + itemH);
  doc.line(xs[3], itemTop, xs[3], itemTop + itemH);
  doc.text(subjectLines, xs[0] + 2, itemTop + 5.5);
  setFont(9, 'italic');
  doc.text(classTypeLines, xs[0] + 2, itemTop + classTypeOffset);
  setFont(9);
  textRight(data.quantity, xs[1] + widths[1] - 3, itemTop + 5.5);
  textRight(money(data.unitPrice), xs[2] + widths[2] - 3, itemTop + 5.5);
  textRight(money(data.totalAmount), xs[3] + widths[3] - 3, itemTop + 5.5);

  const totalTop = itemTop + itemH;
  doc.rect(margin, totalTop, tableW, totalH);
  doc.line(xs[3], totalTop, xs[3], totalTop + totalH);
  setFont(9, 'bold');
  doc.text('Total CHF', xs[0] + 2, totalTop + 4.5);
  textRight(money(data.totalAmount), xs[3] + widths[3] - 3, totalTop + 4.5);

  y = totalTop + totalH + 8;
  setFont(10.5);
  y = addWrappedText(doc, s.paymentText(), margin, y, contentW, 5.5);
  y += 7;
  doc.text(s.closing, margin, y);
  doc.text('Gioia Birukoff', margin, y + 5.5);
  const contentBottom = y + 5.5 + 2;

  if (qrAttachment?.dataUrl) {
    try {
      doc.addImage(qrAttachment.dataUrl, undefined, pageW - margin - 70, pageH - 62, 70, 42);
    } catch (err) {
      console.error('Could not add QR image:', err);
    }
  }

  // Place the QR payment part on this page when the footnote still fits above
  // the 105mm payment-part zone; otherwise fall back to appending it as page 2.
  setFont(7.2);
  const footnoteLines = doc.splitTextToSize(String(s.footnote || ''), contentW);
  const footnoteLineH = 3.6;
  const qrZoneTop = pageH - QR_PART_HEIGHT_MM;
  const footnoteYAboveQr = qrZoneTop - 3 - (footnoteLines.length - 1) * footnoteLineH;
  const qrOnFirstPage = Boolean(qrAttachment?.pdfBytes) && footnoteYAboveQr >= contentBottom + 2.5;
  doc.text(footnoteLines, margin, qrOnFirstPage ? footnoteYAboveQr : pageH - 22);

  return await mergeWithQrPdf(doc.output('arraybuffer'), qrAttachment, qrOnFirstPage);
}

async function persistLessonCount(courseId, studentId, count) {
  try {
    const res = await apiFetch('/api/update-enrolment', {
      method: 'PATCH',
      body: { course_id: courseId, student_id: studentId, invoice_lesson_count: count },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('Could not persist lesson count:', body.error || res.status);
    }
  } catch (err) {
    console.error('Could not persist lesson count:', err);
  }
}

export async function submitInvoice() {
  const btn = document.getElementById('inv-submit');
  const msg = document.getElementById('inv-msg');
  msg.classList.remove('is-visible-block');

  const data = getInvoiceData();
  const isBulk = currentBulkRecipients.length > 0;
  const bulkRecipients = isBulk ? selectedBulkRecipients() : [];
  if (isBulk && !bulkRecipients.length) {
    msg.textContent = 'Select at least one recipient.';
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    return;
  }
  if (!data.invoiceNumber || !data.recipientEmail || !data.totalAmount) {
    msg.textContent = 'Please fill invoice number, email, and amount.';
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    return;
  }
  const selectedQrAttachments = isBulk
    ? bulkRecipients.map((student) => activeQrAttachment(student))
    : [activeQrAttachment()];
  if (
    selectedQrAttachments.some(
      (attachment) => attachment.fileType === 'pdf' && !attachment.pdfBytes
    )
  ) {
    msg.textContent = 'The QR bill PDF is still loading. Please wait a moment.';
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    return;
  }
  const missingQrCount = selectedQrAttachments.filter(
    (attachment) => !hasQrAttachment(attachment)
  ).length;
  const missingQrMessage =
    isBulk && missingQrCount
      ? `${missingQrCount} selected recipient(s) have no QR bill. Send without QR pay part for them?`
      : 'No QR bill has been uploaded. Send the invoice without it?';
  if (missingQrCount && !confirm(missingQrMessage)) {
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

      assignBulkInvoiceNumbers(data.invoiceNumber, bulkRecipients);
      let sent = 0;
      const failed = [];
      for (let i = 0; i < bulkRecipients.length; i += 1) {
        const student = bulkRecipients[i];
        const invoiceNumber = student._invoiceNumber;
        const studentData = getInvoiceData(student, invoiceNumber);
        btn.textContent = `sending ${i + 1}/${bulkRecipients.length}…`;
        const pdfBase64 = await buildInvoicePdf(studentData, activeQrAttachment(student));
        try {
          await sendInvoiceRequest(studentData, student, pdfBase64);
          sent += 1;
          const rowMsg = document.getElementById(`invoice-msg-${currentCourse.id}-${student.id}`);
          if (rowMsg) showMessage(rowMsg, 'sent');
          if (student.invoice_lesson_count !== student._originalLessonCount) {
            persistLessonCount(currentCourse.id, student.id, student.invoice_lesson_count);
          }
        } catch (err) {
          failed.push(`${studentName(student)}: ${err.message || err}`);
        }
      }

      msg.textContent = failed.length
        ? `Sent ${sent}; failed ${failed.length}. ${failed.join(' | ')}`
        : `Sent ${sent} invoices.`;
      msg.className = failed.length ? 'modal-msg err' : 'modal-msg success';
      msg.classList.add('is-visible-block');
      btn.textContent = failed.length ? 'send invoices' : 'sent';
      btn.disabled = failed.length ? false : true;
      if (failed.length) updateBulkInvoiceCount();
      if (!failed.length) setTimeout(() => closeInvoiceModal(), MESSAGE_TIMEOUT_MS);
      return;
    }

    const pdfBase64 = await buildInvoicePdf(data, activeQrAttachment());
    btn.textContent = 'sending…';
    await sendInvoiceRequest(data, currentStudent, pdfBase64);

    const rowMsg = document.getElementById(`invoice-msg-${currentCourse.id}-${currentStudent.id}`);
    if (rowMsg) showMessage(rowMsg, 'sent');
    const sentQuantity = numVal('inv-quantity');
    if (sentQuantity !== _singleOpenQuantity) {
      persistLessonCount(currentCourse.id, currentStudent.id, sentQuantity || null);
    }
    msg.textContent = 'Invoice sent.';
    msg.className = 'modal-msg success';
    msg.classList.add('is-visible-block');
    btn.textContent = 'sent';
    setTimeout(() => closeInvoiceModal(), MESSAGE_TIMEOUT_MS);
  } catch (err) {
    msg.textContent = 'Error: ' + (err.message || err);
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    btn.textContent = isBulk ? 'send invoices' : 'send invoice';
    btn.disabled = false;
  }
}

function invoicePayloadFields(data) {
  return {
    invoice_number: data.invoiceNumber,
    customer_reference: data.customerReference,
    subject: data.subject,
    quantity: data.quantity,
    unit_price: data.unitPrice,
    total_amount: data.totalAmount,
    currency: data.currency,
    invoice_date: data.invoiceDate,
    due_date: data.dueDate,
  };
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
      invoice: invoicePayloadFields(data),
      pdf_base64: pdfBase64,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

// Records a downloaded invoice (status 'downloaded') and archives its PDF so it
// shows in the overview. Sending the same number later flips it to 'sent'.
async function logInvoiceDownload(data, student, pdfBase64) {
  const res = await apiFetch('/api/log-invoice-download', {
    method: 'POST',
    body: {
      student_id: student.id,
      course_id: currentCourse.id,
      language: data.language,
      invoice: invoicePayloadFields(data),
      pdf_base64: pdfBase64,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

// Assigns each recipient a stable invoice number derived from the base, keeping
// any already assigned (e.g. from an earlier download) so download → send reuses
// the same number. Caller must validate the base format first.
function assignBulkInvoiceNumbers(base, recipients) {
  // Seed from every recipient (even deselected ones that were already downloaded)
  // so a fresh number never collides with one already logged for someone else.
  const used = new Set(currentBulkRecipients.map((r) => r._invoiceNumber).filter(Boolean));
  let offset = 0;
  for (const recipient of recipients) {
    if (recipient._invoiceNumber) continue;
    let candidate = incrementInvoiceNumber(base, offset);
    offset += 1;
    while (used.has(candidate)) {
      candidate = incrementInvoiceNumber(base, offset);
      offset += 1;
    }
    recipient._invoiceNumber = candidate;
    used.add(candidate);
  }
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function invoiceFilename(data) {
  const prefix = data.language === 'en' ? 'invoice' : 'rechnung';
  const numberPart = String(data.invoiceNumber || 'lwg').replace(/[^a-z0-9._-]+/gi, '-');
  return `${prefix}-${numberPart}.pdf`;
}

function downloadPdfFromBase64(base64, filename) {
  const blob = new Blob([base64ToBytes(base64)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadInvoice() {
  const btn = document.getElementById('inv-download');
  const sendBtn = document.getElementById('inv-submit');
  const msg = document.getElementById('inv-msg');
  msg.classList.remove('is-visible-block');

  const data = getInvoiceData();
  const isBulk = currentBulkRecipients.length > 0;
  const bulkRecipients = isBulk ? selectedBulkRecipients() : [];
  if (isBulk && !bulkRecipients.length) {
    msg.textContent = 'Select at least one recipient.';
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    return;
  }
  if (!data.invoiceNumber || !data.totalAmount) {
    msg.textContent = 'Please fill invoice number and amount.';
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    return;
  }

  const selectedQrAttachments = isBulk
    ? bulkRecipients.map((student) => activeQrAttachment(student))
    : [activeQrAttachment()];
  if (
    selectedQrAttachments.some(
      (attachment) => attachment.fileType === 'pdf' && !attachment.pdfBytes
    )
  ) {
    msg.textContent = 'The QR bill PDF is still loading. Please wait a moment.';
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    return;
  }

  const originalLabel = btn.textContent;
  btn.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('PDF library not loaded — please reload the page.');
    }

    const recipients = isBulk ? bulkRecipients : [currentStudent];
    if (isBulk) {
      const invoiceNumberPattern = /^(LWG-\d{4}-)(\d{4})$/;
      if (!invoiceNumberPattern.test(data.invoiceNumber)) {
        throw new Error('Invoice number must use the format LWG-YYYY-0001.');
      }
      assignBulkInvoiceNumbers(data.invoiceNumber, bulkRecipients);
    }

    let done = 0;
    const failed = [];
    for (let i = 0; i < recipients.length; i += 1) {
      const student = recipients[i];
      const invoiceNumber = isBulk ? student._invoiceNumber : data.invoiceNumber;
      const studentData = isBulk ? getInvoiceData(student, invoiceNumber) : data;
      btn.textContent =
        recipients.length > 1 ? `preparing ${i + 1}/${recipients.length}…` : 'preparing…';
      const pdfBase64 = await buildInvoicePdf(studentData, activeQrAttachment(student));
      downloadPdfFromBase64(pdfBase64, invoiceFilename(studentData));
      try {
        await logInvoiceDownload(studentData, student, pdfBase64);
        done += 1;
      } catch (err) {
        failed.push(`${studentName(student)}: ${err.message || err}`);
      }
    }

    if (failed.length) {
      msg.textContent = `Downloaded ${recipients.length}; ${failed.length} not recorded in overview. ${failed.join(' | ')}`;
      msg.className = 'modal-msg err';
    } else {
      msg.textContent =
        done === 1
          ? 'Invoice downloaded and added to the overview.'
          : `Downloaded ${done} invoices and added them to the overview.`;
      msg.className = 'modal-msg success';
    }
    msg.classList.add('is-visible-block');
  } catch (err) {
    msg.textContent = 'Error: ' + (err.message || err);
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
  } finally {
    btn.textContent = originalLabel;
    btn.disabled = false;
    if (sendBtn) sendBtn.disabled = isBulk ? selectedBulkRecipients().length === 0 : false;
  }
}
