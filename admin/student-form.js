/* ── Student add/edit form page ───────────────────────────────────── */
import { initAuth, getSession } from './auth.js';
import { apiFetch } from './api.js';

const BILLING_FIELDS = [
  'sm-billing-name',
  'sm-billing-phone',
  'sm-billing-email',
  'sm-billing-street',
  'sm-billing-street-number',
  'sm-billing-postcode',
  'sm-billing-city',
];

function setValue(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v ?? '';
}

function populate(data) {
  setValue('sm-id', data.id);
  setValue('sm-first-name', data.first_name);
  setValue('sm-last-name', data.last_name);
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

function setBilling(show) {
  const cb = document.getElementById('sm-billing-separate');
  const section = document.getElementById('sm-billing-section');
  const hint = document.getElementById('sm-billing-hint');
  cb.checked = show;
  section.style.display = show ? 'block' : 'none';
  if (hint) hint.style.display = show ? 'none' : 'block';
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

function buildBody() {
  const body = {
    first_name: document.getElementById('sm-first-name').value.trim(),
    last_name: document.getElementById('sm-last-name').value.trim(),
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
    body.billing_phone = document.getElementById('sm-billing-phone').value.trim() || null;
    body.billing_email = document.getElementById('sm-billing-email').value.trim() || null;
    body.billing_street = document.getElementById('sm-billing-street').value.trim() || null;
    body.billing_street_number =
      document.getElementById('sm-billing-street-number').value.trim() || null;
    body.billing_postcode = document.getElementById('sm-billing-postcode').value.trim() || null;
    body.billing_city = document.getElementById('sm-billing-city').value.trim() || null;
  } else {
    body.billing_name = null;
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
  msgEl.style.display = 'none';

  const firstName = document.getElementById('sm-first-name').value.trim();
  const lastName = document.getElementById('sm-last-name').value.trim();
  if (!firstName || !lastName) {
    msgEl.textContent = 'First name and last name are required.';
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    return;
  }

  btn.textContent = 'saving…';
  btn.disabled = true;

  const body = buildBody();
  try {
    const res = await apiFetch('/api/save-student', { method: 'POST', body });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');
    window.location.href = '/admin/students';
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err';
    msgEl.style.display = 'block';
    btn.textContent = 'save student';
    btn.disabled = false;
  }
}

(async function init() {
  try {
    await initAuth();
  } catch {
    window.location.href = '/admin/students';
    return;
  }
  const session = await getSession();
  if (!session) {
    window.location.href = '/admin/students';
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
  }

  wireBillingToggle();
  document.getElementById('student-form').addEventListener('submit', handleSubmit);

  document.getElementById('page-loading').style.display = 'none';
  document.getElementById('page-content').style.display = '';
})();
