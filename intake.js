/* ══════════════════════════════════════════════════════════════════
   STUDENT INTAKE FORM LOGIC
   ══════════════════════════════════════════════════════════════════
   - Reads ?token= from URL to pre-fill form with existing student data
   - Validates required fields (first name, last name, email, consent)
   - Shows/hides location field based on course format selection
   - Submits to /api/submit-intake
   ══════════════════════════════════════════════════════════════════ */

import { isValidEmail, showFieldError, scrollToFirstError } from './form-validate.js';

const token = new URLSearchParams(window.location.search).get('token');

const formState = document.getElementById('form-state');
const loadingState = document.getElementById('loading-state');
const successState = document.getElementById('success-state');
const invalidState = document.getElementById('invalid-state');

/* ── Init ────────────────────────────────────────────────────────── */
(async function init() {
  if (token) {
    try {
      const res = await fetch('/api/get-intake?token=' + encodeURIComponent(token));
      if (!res.ok) {
        let msg = null;
        try {
          const err = await res.json();
          if (err && err.error) msg = err.error;
        } catch {
          /* ignore */
        }
        const msgEl = invalidState.querySelector('p');
        if (msg && msgEl) msgEl.textContent = msg;
        loadingState.style.display = 'none';
        invalidState.style.display = 'block';
        return;
      }
      const data = await res.json();
      prefill(data);
    } catch {
      loadingState.style.display = 'none';
      invalidState.style.display = 'block';
      return;
    }
  }

  loadingState.style.display = 'none';
  formState.style.display = 'block';
})();

/* ── Pre-fill form from existing student data ────────────────────── */
function prefill(s) {
  if (s.first_name) document.getElementById('in-first-name').value = s.first_name;
  if (s.last_name) document.getElementById('in-last-name').value = s.last_name;
  if (s.email) document.getElementById('in-email').value = s.email;
  if (s.phone) document.getElementById('in-phone').value = s.phone;
  if (s.nationality) document.getElementById('in-nationality').value = s.nationality;
  if (s.street) document.getElementById('in-street').value = s.street;
  if (s.street_number) document.getElementById('in-street-number').value = s.street_number;
  if (s.postcode) document.getElementById('in-postcode').value = s.postcode;
  if (s.emergency_contact) document.getElementById('in-ec-name').value = s.emergency_contact;
  if (s.ec_phone) document.getElementById('in-ec-phone').value = s.ec_phone;
  if (s.ec_email) document.getElementById('in-ec-email').value = s.ec_email;
  if (s.ec_relationship) document.getElementById('in-ec-relationship').value = s.ec_relationship;
  if (s.native_language) document.getElementById('in-native-lang').value = s.native_language;
  if (s.target_language) document.getElementById('in-target-lang').value = s.target_language;
  if (s.current_level) document.getElementById('in-level').value = s.current_level;
  if (s.learning_goals) document.getElementById('in-goals').value = s.learning_goals;
  if (s.desired_start_date) document.getElementById('in-start-date').value = s.desired_start_date;
  if (s.billing_name) document.getElementById('in-billing-name').value = s.billing_name;
  if (s.billing_address) document.getElementById('in-billing-address').value = s.billing_address;
  if (s.billing_email) document.getElementById('in-billing-email').value = s.billing_email;
  if (s.referral_source) document.getElementById('in-referral').value = s.referral_source;

  // Radio buttons
  if (s.course_type) selectRadio('course-type', s.course_type);
  if (s.course_format) selectRadio('course-format', s.course_format);
  if (s.location) selectRadio('location', s.location);
  if (s.payment_method) selectRadio('payment-method', s.payment_method);

  // Show location if in-person pre-selected
  if (s.course_format === 'in-person') {
    document.getElementById('location-field').style.display = 'block';
  }

  // Auto-check "same as above" if billing matches student name/address
  const norm = (v) => (v || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const studentName = norm(`${s.first_name || ''} ${s.last_name || ''}`);
  const studentAddr = norm([s.street, s.street_number, s.postcode].filter(Boolean).join(', '));
  if (
    s.billing_name &&
    s.billing_address &&
    norm(s.billing_name) === studentName &&
    norm(s.billing_address) === studentAddr
  ) {
    document.getElementById('in-billing-same').checked = true;
    document.getElementById('billing-fields').style.display = 'none';
  }
}

function selectRadio(name, value) {
  const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (radio) radio.checked = true;
}

function getRadio(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : null;
}

/* ── Billing "same as above" checkbox ────────────────────────────── */
document.getElementById('in-billing-same').addEventListener('change', function () {
  const billingFields = document.getElementById('billing-fields');
  if (this.checked) {
    const firstName = document.getElementById('in-first-name').value.trim();
    const lastName = document.getElementById('in-last-name').value.trim();
    const street = document.getElementById('in-street').value.trim();
    const streetNumber = document.getElementById('in-street-number').value.trim();
    const postcode = document.getElementById('in-postcode').value.trim();
    document.getElementById('in-billing-name').value = [firstName, lastName]
      .filter(Boolean)
      .join(' ');
    document.getElementById('in-billing-address').value = [street, streetNumber, postcode]
      .filter(Boolean)
      .join(', ');
    billingFields.style.display = 'none';
  } else {
    billingFields.style.display = 'block';
  }
});

/* ── Show/hide location field based on format selection ───────────── */
document.getElementById('in-course-format').addEventListener('click', (e) => {
  const radio = e.target.closest('input[type="radio"]') || e.target.closest('label');
  if (!radio) return;
  // Small delay to let the radio update
  setTimeout(() => {
    const format = getRadio('course-format');
    document.getElementById('location-field').style.display =
      format === 'in-person' ? 'block' : 'none';
  }, 10);
});

/* ── Validation ──────────────────────────────────────────────────── */
function validate() {
  let ok = true;

  const firstName = document.getElementById('in-first-name').value.trim();
  const lastName = document.getElementById('in-last-name').value.trim();
  const email = document.getElementById('in-email').value.trim();
  const consent = document.getElementById('in-consent').checked;

  showFieldError('err-first-name', !firstName);
  if (!firstName) ok = false;
  showFieldError('err-last-name', !lastName);
  if (!lastName) ok = false;
  showFieldError('err-email', !email || !isValidEmail(email));
  if (!email || !isValidEmail(email)) ok = false;
  showFieldError('err-consent', !consent);
  if (!consent) ok = false;

  return ok;
}

/* ── Submit ──────────────────────────────────────────────────────── */
document.getElementById('submit-btn').addEventListener('click', async () => {
  if (!validate()) {
    scrollToFirstError(document.getElementById('form-state'));
    return;
  }

  const btn = document.getElementById('submit-btn');
  const errEl = document.getElementById('form-error');
  errEl.style.display = 'none';
  btn.dataset.loading = '';
  btn.disabled = true;

  const body = {
    token: token || undefined,
    first_name: document.getElementById('in-first-name').value.trim(),
    last_name: document.getElementById('in-last-name').value.trim(),
    email: document.getElementById('in-email').value.trim(),
    phone: document.getElementById('in-phone').value.trim() || null,
    nationality: document.getElementById('in-nationality').value.trim() || null,
    street: document.getElementById('in-street').value.trim() || null,
    street_number: document.getElementById('in-street-number').value.trim() || null,
    postcode: document.getElementById('in-postcode').value.trim() || null,
    emergency_contact: document.getElementById('in-ec-name').value.trim() || null,
    ec_phone: document.getElementById('in-ec-phone').value.trim() || null,
    ec_email: document.getElementById('in-ec-email').value.trim() || null,
    ec_relationship: document.getElementById('in-ec-relationship').value.trim() || null,
    course_type: getRadio('course-type'),
    course_format: getRadio('course-format'),
    location: getRadio('location'),
    target_language: document.getElementById('in-target-lang').value || null,
    native_language: document.getElementById('in-native-lang').value.trim() || null,
    current_level: document.getElementById('in-level').value || null,
    learning_goals: document.getElementById('in-goals').value.trim() || null,
    desired_start_date: document.getElementById('in-start-date').value || null,
    billing_name: document.getElementById('in-billing-name').value.trim() || null,
    billing_address: document.getElementById('in-billing-address').value.trim() || null,
    billing_email: document.getElementById('in-billing-email').value.trim() || null,
    payment_method: getRadio('payment-method'),
    referral_source: document.getElementById('in-referral').value || null,
    consent_given: true,
  };

  try {
    const res = await fetch('/api/submit-intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error();

    formState.style.display = 'none';
    successState.style.display = 'block';
  } catch {
    errEl.style.display = 'block';
    delete btn.dataset.loading;
    btn.disabled = false;
  }
});
