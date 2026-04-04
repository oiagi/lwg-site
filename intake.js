/* ══════════════════════════════════════════════════════════════════
   STUDENT INTAKE FORM LOGIC
   ══════════════════════════════════════════════════════════════════
   - Reads ?token= from URL to pre-fill form with existing student data
   - Validates required fields (first name, last name, email, consent)
   - Shows/hides location field based on course format selection
   - Submits to /api/submit-intake
   ══════════════════════════════════════════════════════════════════ */

import { isValidEmail, showFieldError } from './form-validate.js';

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
  if (s.address_line1) document.getElementById('in-address-line1').value = s.address_line1;
  if (s.address_line2) document.getElementById('in-address-line2').value = s.address_line2;
  if (s.address_city) document.getElementById('in-address-city').value = s.address_city;
  if (s.postcode) document.getElementById('in-postcode').value = s.postcode;
  if (s.address_country) document.getElementById('in-address-country').value = s.address_country;
  if (s.emergency_contact_name) document.getElementById('in-emergency-name').value = s.emergency_contact_name;
  if (s.emergency_contact_relation)
    document.getElementById('in-emergency-relation').value = s.emergency_contact_relation;
  if (s.emergency_contact_phone)
    document.getElementById('in-emergency-phone').value = s.emergency_contact_phone;
  if (s.emergency_contact_email)
    document.getElementById('in-emergency-email').value = s.emergency_contact_email;
  if (s.native_language) document.getElementById('in-native-lang').value = s.native_language;
  if (s.target_language) document.getElementById('in-target-lang').value = s.target_language;
  if (s.current_level) document.getElementById('in-level').value = s.current_level;
  if (s.learning_goals) document.getElementById('in-goals').value = s.learning_goals;
  if (s.desired_start_date) document.getElementById('in-start-date').value = s.desired_start_date;
  if (s.billing_name) document.getElementById('in-billing-name').value = s.billing_name;
  if (s.billing_address_line1)
    document.getElementById('in-billing-address-line1').value = s.billing_address_line1;
  if (s.billing_address_line2)
    document.getElementById('in-billing-address-line2').value = s.billing_address_line2;
  if (s.billing_city) document.getElementById('in-billing-city').value = s.billing_city;
  if (s.billing_postcode) document.getElementById('in-billing-postcode').value = s.billing_postcode;
  if (s.billing_country) document.getElementById('in-billing-country').value = s.billing_country;
  if (s.billing_email) document.getElementById('in-billing-email').value = s.billing_email;
  const billingSame = s.billing_same_as_student !== false;
  document.getElementById('in-billing-same').checked = billingSame;
  setBillingFieldsVisibility();
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
}

function selectRadio(name, value) {
  const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (radio) radio.checked = true;
}

function getRadio(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : null;
}

function setBillingFieldsVisibility() {
  const billingSame = document.getElementById('in-billing-same').checked;
  document.getElementById('billing-fields').style.display = billingSame ? 'none' : 'block';
}

document.getElementById('in-billing-same').addEventListener('change', setBillingFieldsVisibility);
setBillingFieldsVisibility();

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
  if (!validate()) return;

  const btn = document.getElementById('submit-btn');
  const errEl = document.getElementById('form-error');
  errEl.style.display = 'none';
  btn.textContent = 'submitting…';
  btn.disabled = true;

  const billingSame = document.getElementById('in-billing-same').checked;
  const studentAddressLine1 = document.getElementById('in-address-line1').value.trim() || null;
  const studentAddressLine2 = document.getElementById('in-address-line2').value.trim() || null;
  const studentAddressCity = document.getElementById('in-address-city').value.trim() || null;
  const studentPostcode = document.getElementById('in-postcode').value.trim() || null;
  const studentAddressCountry = document.getElementById('in-address-country').value.trim() || null;

  const billingName = billingSame
    ? `${document.getElementById('in-first-name').value.trim()} ${document.getElementById('in-last-name').value.trim()}`.trim()
    : document.getElementById('in-billing-name').value.trim() || null;
  const billingAddressLine1 = billingSame
    ? studentAddressLine1
    : document.getElementById('in-billing-address-line1').value.trim() || null;
  const billingAddressLine2 = billingSame
    ? studentAddressLine2
    : document.getElementById('in-billing-address-line2').value.trim() || null;
  const billingCity = billingSame
    ? studentAddressCity
    : document.getElementById('in-billing-city').value.trim() || null;
  const billingPostcode = billingSame
    ? studentPostcode
    : document.getElementById('in-billing-postcode').value.trim() || null;
  const billingCountry = billingSame
    ? studentAddressCountry
    : document.getElementById('in-billing-country').value.trim() || null;
  const billingEmail = billingSame
    ? document.getElementById('in-email').value.trim()
    : document.getElementById('in-billing-email').value.trim() || null;

  const body = {
    token: token || undefined,
    first_name: document.getElementById('in-first-name').value.trim(),
    last_name: document.getElementById('in-last-name').value.trim(),
    email: document.getElementById('in-email').value.trim(),
    phone: document.getElementById('in-phone').value.trim() || null,
    nationality: document.getElementById('in-nationality').value.trim() || null,
    address_line1: studentAddressLine1,
    address_line2: studentAddressLine2,
    address_city: studentAddressCity,
    postcode: studentPostcode,
    address_country: studentAddressCountry,
    emergency_contact_name: document.getElementById('in-emergency-name').value.trim() || null,
    emergency_contact_relation:
      document.getElementById('in-emergency-relation').value.trim() || null,
    emergency_contact_phone: document.getElementById('in-emergency-phone').value.trim() || null,
    emergency_contact_email: document.getElementById('in-emergency-email').value.trim() || null,
    course_type: getRadio('course-type'),
    course_format: getRadio('course-format'),
    location: getRadio('location'),
    target_language: document.getElementById('in-target-lang').value || null,
    native_language: document.getElementById('in-native-lang').value.trim() || null,
    current_level: document.getElementById('in-level').value || null,
    learning_goals: document.getElementById('in-goals').value.trim() || null,
    desired_start_date: document.getElementById('in-start-date').value || null,
    billing_same_as_student: billingSame,
    billing_name: billingName || null,
    billing_address_line1: billingAddressLine1,
    billing_address_line2: billingAddressLine2,
    billing_city: billingCity,
    billing_postcode: billingPostcode,
    billing_country: billingCountry,
    billing_email: billingEmail,
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
    btn.textContent = 'submit registration';
    btn.disabled = false;
  }
});
