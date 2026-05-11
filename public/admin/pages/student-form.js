/* ── Student add/edit form page ───────────────────────────────────── */
import { initAuth, getSession } from '../core/auth.js';
import { apiFetch } from '../core/api.js';

const BILLING_FIELDS = [
  'sm-billing-name',
  'sm-billing-gender',
  'sm-billing-gender-note',
  'sm-billing-phone',
  'sm-billing-email',
  'sm-billing-street',
  'sm-billing-street-number',
  'sm-billing-postcode',
  'sm-billing-city',
];

let initialFormState = '';
let formIsDirty = false;
let isSubmitting = false;

function setValue(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v ?? '';
}

function formSnapshot() {
  const form = document.getElementById('student-form');
  if (!form) return '';
  return [...form.querySelectorAll('input, select, textarea')]
    .map((el) => `${el.id}:${el.type === 'checkbox' ? el.checked : el.value}`)
    .join('|');
}

function rememberCleanState() {
  initialFormState = formSnapshot();
  formIsDirty = false;
}

function updateDirtyState() {
  formIsDirty = formSnapshot() !== initialFormState;
}

function confirmDiscard() {
  return !formIsDirty || confirm('Discard unsaved student changes?');
}

function wireDirtyGuard() {
  const form = document.getElementById('student-form');
  form?.addEventListener('input', updateDirtyState);
  form?.addEventListener('change', updateDirtyState);
  form
    ?.querySelectorAll('#sm-first-name, #sm-last-name, #sm-email, #sm-ec-email, #sm-billing-email')
    .forEach((field) => {
      field.addEventListener('input', () => clearFieldError(field.id));
    });

  window.addEventListener('beforeunload', (e) => {
    if (!formIsDirty || isSubmitting) return;
    e.preventDefault();
    e.returnValue = '';
  });

  document.querySelectorAll('.page-form-back, .page-form-actions .modal-cancel').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (confirmDiscard()) return;
      e.preventDefault();
    });
  });
}

function populate(data) {
  setValue('sm-id', data.id);
  setValue('sm-first-name', data.first_name);
  setValue('sm-last-name', data.last_name);
  setValue('sm-gender', data.gender);
  setValue('sm-gender-note', data.gender_note);
  setGenderNote(data.gender === 'other');
  setValue('sm-email', data.email);
  setValue('sm-phone', data.phone);
  setValue('sm-street', data.street);
  setValue('sm-street-number', data.street_number);
  setValue('sm-postcode', data.postcode);
  setValue('sm-city', data.city);
  setValue('sm-ec-name', data.emergency_contact);
  setValue('sm-ec-phone', data.ec_phone);
  setValue('sm-ec-email', data.ec_email);
  setValue('sm-ec-relationship', data.ec_relationship);
  setValue('sm-billing-name', data.billing_name);
  setValue('sm-billing-gender', data.billing_gender || data.gender);
  setValue('sm-billing-gender-note', data.billing_gender_note);
  setBillingGenderNote((data.billing_gender || data.gender) === 'other');
  setValue('sm-billing-phone', data.billing_phone);
  setValue('sm-billing-email', data.billing_email);

  if (data.billing_street || data.billing_postcode) {
    setValue('sm-billing-street', data.billing_street);
    setValue('sm-billing-street-number', data.billing_street_number);
    setValue('sm-billing-postcode', data.billing_postcode);
    setValue('sm-billing-city', data.billing_city);
  } else if (data.billing_address) {
    // Legacy fallback: parse combined address "Street 3a, 8001 Zürich"
    const [streetPart = '', cityPart = ''] = data.billing_address.split(',').map((p) => p.trim());
    const streetM = streetPart.match(/^(.+?)\s+(\d+\w*)$/);
    if (streetM) {
      setValue('sm-billing-street', streetM[1]);
      setValue('sm-billing-street-number', streetM[2]);
    } else {
      setValue('sm-billing-street', streetPart);
    }
    const cityM = cityPart.match(/^(\d{4,5})\s+(.+)$/);
    if (cityM) {
      setValue('sm-billing-postcode', cityM[1]);
      setValue('sm-billing-city', cityM[2]);
    }
  }

  setValue('sm-vat', data.vat_number);
  setValue('sm-payment-method', data.payment_method);
  setValue('sm-notes', data.progress_notes);
  document.getElementById('sm-status').value =
    data.status || (data.active !== false ? 'active' : 'inactive');

  const hasBilling = !!(data.billing_street || data.billing_postcode || data.billing_name);
  setBilling(hasBilling);
}

function setGenderNote(show) {
  const wrap = document.getElementById('sm-gender-note-wrap');
  if (!wrap) return;
  wrap.classList.toggle('is-hidden', !show);
  if (!show) setValue('sm-gender-note', '');
}

function setBillingGenderNote(show) {
  const wrap = document.getElementById('sm-billing-gender-note-wrap');
  if (!wrap) return;
  wrap.classList.toggle('is-hidden', !show);
  if (!show) setValue('sm-billing-gender-note', '');
}

function wireGenderToggle() {
  const select = document.getElementById('sm-gender');
  select?.addEventListener('change', () => {
    setGenderNote(select.value === 'other');
  });

  const billingSelect = document.getElementById('sm-billing-gender');
  billingSelect?.addEventListener('change', () => {
    setBillingGenderNote(billingSelect.value === 'other');
  });
}

function setBilling(show) {
  const cb = document.getElementById('sm-billing-separate');
  const section = document.getElementById('sm-billing-section');
  const hint = document.getElementById('sm-billing-hint');
  cb.checked = show;
  section.classList.toggle('is-hidden', !show);
  if (hint) hint.classList.toggle('is-hidden', show);
}

function wireBillingToggle() {
  const cb = document.getElementById('sm-billing-separate');
  cb.addEventListener('change', (e) => {
    const show = e.target.checked;
    setBilling(show);
    if (!show) {
      BILLING_FIELDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    }
  });
}

function setFieldError(id, message) {
  const field = document.getElementById(id);
  if (!field) return null;
  const wrap = field.closest('.modal-field');
  let error = wrap?.querySelector('.field-error');
  if (!error && wrap) {
    error = document.createElement('span');
    error.className = 'field-error';
    error.id = `${id}-error`;
    wrap.appendChild(error);
  }
  field.setAttribute('aria-invalid', 'true');
  if (error) {
    error.textContent = message;
    field.setAttribute('aria-describedby', error.id);
  }
  return field;
}

function clearFieldError(id) {
  const field = document.getElementById(id);
  if (!field) return;
  const wrap = field.closest('.modal-field');
  const error = wrap?.querySelector('.field-error');
  field.removeAttribute('aria-invalid');
  field.removeAttribute('aria-describedby');
  if (error) error.textContent = '';
}

function validateForm() {
  const requiredFields = [
    ['sm-first-name', 'First name is required.'],
    ['sm-last-name', 'Last name is required.'],
  ];
  const emailFields = [
    ['sm-email', 'Enter a valid student email.'],
    ['sm-ec-email', 'Enter a valid emergency contact email.'],
    ['sm-billing-email', 'Enter a valid billing email.'],
  ];
  const invalid = [];

  [...requiredFields, ...emailFields].forEach(([id]) => clearFieldError(id));

  requiredFields.forEach(([id, message]) => {
    const el = document.getElementById(id);
    if (!el?.value.trim()) invalid.push(setFieldError(id, message));
  });

  emailFields.forEach(([id, message]) => {
    const el = document.getElementById(id);
    if (el?.value.trim() && !el.validity.valid) invalid.push(setFieldError(id, message));
  });

  const firstInvalid = invalid.find(Boolean);
  if (firstInvalid) {
    firstInvalid.focus();
    return false;
  }
  return true;
}

function buildBody() {
  const body = {
    first_name: document.getElementById('sm-first-name').value.trim(),
    last_name: document.getElementById('sm-last-name').value.trim(),
    gender: document.getElementById('sm-gender').value || null,
    gender_note:
      document.getElementById('sm-gender').value === 'other'
        ? document.getElementById('sm-gender-note').value.trim() || null
        : null,
    email: document.getElementById('sm-email').value.trim() || null,
    phone: document.getElementById('sm-phone').value.trim() || null,
    street: document.getElementById('sm-street').value.trim() || null,
    street_number: document.getElementById('sm-street-number').value.trim() || null,
    postcode: document.getElementById('sm-postcode').value.trim() || null,
    city: document.getElementById('sm-city').value.trim() || null,
    emergency_contact: document.getElementById('sm-ec-name').value.trim() || null,
    ec_phone: document.getElementById('sm-ec-phone').value.trim() || null,
    ec_email: document.getElementById('sm-ec-email').value.trim() || null,
    ec_relationship: document.getElementById('sm-ec-relationship').value.trim() || null,
    vat_number: document.getElementById('sm-vat').value.trim() || null,
    payment_method: document.getElementById('sm-payment-method').value || null,
    progress_notes: document.getElementById('sm-notes').value.trim() || null,
    status: document.getElementById('sm-status').value,
  };

  if (document.getElementById('sm-billing-separate').checked) {
    body.billing_name = document.getElementById('sm-billing-name').value.trim() || null;
    body.billing_gender =
      document.getElementById('sm-billing-gender').value ||
      document.getElementById('sm-gender').value ||
      null;
    body.billing_gender_note =
      body.billing_gender === 'other'
        ? document.getElementById('sm-billing-gender-note').value.trim() || null
        : null;
    body.billing_phone = document.getElementById('sm-billing-phone').value.trim() || null;
    body.billing_email = document.getElementById('sm-billing-email').value.trim() || null;
    body.billing_street = document.getElementById('sm-billing-street').value.trim() || null;
    body.billing_street_number =
      document.getElementById('sm-billing-street-number').value.trim() || null;
    body.billing_postcode = document.getElementById('sm-billing-postcode').value.trim() || null;
    body.billing_city = document.getElementById('sm-billing-city').value.trim() || null;
  } else {
    body.billing_name = null;
    body.billing_gender = null;
    body.billing_gender_note = null;
    body.billing_phone = null;
    body.billing_email = null;
    body.billing_street = null;
    body.billing_street_number = null;
    body.billing_postcode = null;
    body.billing_city = null;
  }

  const id = document.getElementById('sm-id').value;
  if (id) body.id = id;
  return body;
}

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('sm-submit');
  const msgEl = document.getElementById('sm-msg');
  msgEl.classList.remove('is-visible-block');

  if (!validateForm()) {
    msgEl.textContent = 'Please fix the highlighted fields.';
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    return;
  }

  btn.textContent = 'saving…';
  btn.disabled = true;
  btn.dataset.loading = '';
  isSubmitting = true;

  const body = buildBody();
  try {
    const res = await apiFetch('/api/save-student', { method: 'POST', body });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');
    formIsDirty = false;
    window.location.href = '/admin#students';
  } catch {
    isSubmitting = false;
    msgEl.textContent = 'Something went wrong. Please try again.';
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    btn.textContent = 'save student';
    delete btn.dataset.loading;
    btn.disabled = false;
  }
}

(async function init() {
  try {
    await initAuth();
  } catch {
    window.location.href = '/admin';
    return;
  }
  const session = await getSession();
  if (!session) {
    window.location.href = '/admin';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (id) {
    document.getElementById('student-form-title').textContent = 'edit student';
    try {
      const res = await apiFetch('/api/get-student-detail?id=' + encodeURIComponent(id));
      if (!res.ok) throw new Error();
      const data = await res.json();
      populate(data);
    } catch {
      document.getElementById('page-loading').innerHTML =
        '<p class="loading-state">Could not load student.</p>';
      return;
    }
  } else {
    document.getElementById('sm-status').value = 'active';
    setBilling(false);
    setGenderNote(false);
    setBillingGenderNote(false);
  }

  wireGenderToggle();
  wireBillingToggle();
  wireDirtyGuard();
  rememberCleanState();
  document.getElementById('student-form').addEventListener('submit', handleSubmit);

  document.getElementById('page-loading').classList.add('is-hidden');
  document.getElementById('page-content').classList.remove('is-hidden');
})();
