/* ══════════════════════════════════════════════════════════════════
   STUDENT INTAKE FORM LOGIC
   ══════════════════════════════════════════════════════════════════
   - Reads ?token= from URL to pre-fill form with existing student data
   - Validates required fields (first name, last name, email, consent)
   - Shows/hides level options based on course type selection
   - Shows/hides travel disclaimer based on location selection
   - Copies personal info into billing fields when billing is the same
   - Submits to /api/submit-intake
   ══════════════════════════════════════════════════════════════════ */

import { isValidEmail, showFieldError, scrollToFirstError } from './form-validate.js';

const token = new URLSearchParams(window.location.search).get('token');

const formState = document.getElementById('form-state');
const loadingState = document.getElementById('loading-state');
const successState = document.getElementById('success-state');
const invalidState = document.getElementById('invalid-state');

/* ── Level options per service type ─────────────────────────────── */
const LEVEL_OPTIONS = {
  'language course': [
    { value: '', label: "I'm not sure" },
    { value: 'A1', label: 'A1 — Beginner' },
    { value: 'A2', label: 'A2 — Elementary' },
    { value: 'B1', label: 'B1 — Intermediate' },
    { value: 'B2', label: 'B2 — Upper intermediate' },
    { value: 'C1', label: 'C1 — Advanced' },
    { value: 'C2', label: 'C2 — Proficient' },
  ],
  'exam preparation': [
    { value: '', label: '— please select —' },
    { value: 'Cambridge', label: 'Cambridge' },
    { value: 'TOEFL', label: 'TOEFL' },
    { value: 'IELTS', label: 'IELTS' },
    { value: 'Goethe', label: 'Goethe' },
    { value: 'TELC', label: 'TELC' },
    { value: 'Other', label: 'Other' },
  ],
  tutoring: [
    { value: '', label: '— please select —' },
    { value: 'Primarschule', label: 'Primarschule' },
    { value: 'Sekundarschule', label: 'Sekundarschule' },
    { value: 'Gymnasium', label: 'Gymnasium' },
    { value: 'Other', label: 'Other' },
  ],
};

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

/* ── Update level dropdown based on course type ──────────────────── */
function updateLevelOptions(service, currentValue) {
  const levelField = document.getElementById('level-field');
  const levelSelect = document.getElementById('in-level');
  const options = LEVEL_OPTIONS[service];

  if (!options) {
    // Gymivorbereitung or unrecognised — hide level entirely
    levelField.style.display = 'none';
    levelSelect.value = '';
    return;
  }

  levelField.style.display = 'block';
  levelSelect.innerHTML = options
    .map((o) => `<option value="${o.value}">${o.label}</option>`)
    .join('');

  // Restore previous value if it exists in the new options
  if (currentValue && options.some((o) => o.value === currentValue)) {
    levelSelect.value = currentValue;
  }
}

/* ── Pre-fill form from existing student data ────────────────────── */
function prefill(s) {
  if (s.first_name) document.getElementById('in-first-name').value = s.first_name;
  if (s.last_name) document.getElementById('in-last-name').value = s.last_name;
  if (s.email) document.getElementById('in-email').value = s.email;
  if (s.phone) document.getElementById('in-phone').value = s.phone;
  if (s.street) document.getElementById('in-street').value = s.street;
  if (s.street_number) document.getElementById('in-street-number').value = s.street_number;
  if (s.postcode) document.getElementById('in-postcode').value = s.postcode;
  if (s.city) document.getElementById('in-city').value = s.city;

  // Emergency contact — split combined name into first/last by last space
  if (s.emergency_contact) {
    const lastSpace = s.emergency_contact.lastIndexOf(' ');
    if (lastSpace > 0) {
      document.getElementById('in-ec-first-name').value = s.emergency_contact.slice(0, lastSpace);
      document.getElementById('in-ec-last-name').value = s.emergency_contact.slice(lastSpace + 1);
    } else {
      document.getElementById('in-ec-first-name').value = s.emergency_contact;
    }
  }
  if (s.ec_phone) document.getElementById('in-ec-phone').value = s.ec_phone;
  if (s.ec_email) document.getElementById('in-ec-email').value = s.ec_email;
  if (s.ec_relationship) document.getElementById('in-ec-relationship').value = s.ec_relationship;

  // Course selection
  if (s.service) {
    document.getElementById('in-service').value = s.service;
    updateLevelOptions(s.service, s.current_level);
  }
  if (s.current_level) document.getElementById('in-level').value = s.current_level;
  if (s.location) {
    selectRadio('location', s.location);
    updateTravelDisclaimer(s.location);
  }
  if (s.course_type) selectRadio('course-size', s.course_type);

  // Payment method
  if (s.payment_method) selectRadio('payment-method', s.payment_method);

  // Billing fields — check if billing data exists and differs from personal
  const hasBillingInfo =
    s.billing_name ||
    s.billing_street ||
    s.billing_postcode ||
    s.billing_city ||
    s.billing_email ||
    s.billing_phone ||
    s.billing_address;

  // Determine whether billing differs from personal info
  const norm = (v) => (v || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const fullName = norm(`${s.first_name || ''} ${s.last_name || ''}`);
  const billingName = norm(s.billing_name || '');
  const billingAddrMatches =
    norm(
      `${s.billing_street || ''} ${s.billing_street_number || ''}, ${s.billing_postcode || ''} ${s.billing_city || ''}`
    ) === norm(`${s.street || ''} ${s.street_number || ''}, ${s.postcode || ''} ${s.city || ''}`);

  if (hasBillingInfo && !(billingName === fullName && billingAddrMatches)) {
    document.getElementById('in-billing-differs').checked = true;
    document.getElementById('billing-fields').style.display = 'block';

    // Parse billing name into first/last
    if (s.billing_name) {
      const lastSp = s.billing_name.lastIndexOf(' ');
      if (lastSp > 0) {
        document.getElementById('in-billing-first-name').value = s.billing_name.slice(0, lastSp);
        document.getElementById('in-billing-last-name').value = s.billing_name.slice(lastSp + 1);
      } else {
        document.getElementById('in-billing-first-name').value = s.billing_name;
      }
    }
    if (s.billing_phone) document.getElementById('in-billing-phone').value = s.billing_phone;
    if (s.billing_email) document.getElementById('in-billing-email').value = s.billing_email;

    if (s.billing_street || s.billing_postcode) {
      if (s.billing_street) document.getElementById('in-billing-street').value = s.billing_street;
      if (s.billing_street_number)
        document.getElementById('in-billing-street-number').value = s.billing_street_number;
      if (s.billing_postcode)
        document.getElementById('in-billing-postcode').value = s.billing_postcode;
      if (s.billing_city) document.getElementById('in-billing-city').value = s.billing_city;
    } else if (s.billing_address) {
      // Legacy fallback: parse "Street Number, Postcode City" format
      const [streetPart = '', cityPart = ''] = s.billing_address.split(',').map((p) => p.trim());
      const streetM = streetPart.match(/^(.+?)\s+(\d+\w*)$/);
      if (streetM) {
        document.getElementById('in-billing-street').value = streetM[1];
        document.getElementById('in-billing-street-number').value = streetM[2];
      } else {
        document.getElementById('in-billing-street').value = streetPart;
      }
      const cityM = cityPart.match(/^(\d{4,5})\s+(.+)$/);
      if (cityM) {
        document.getElementById('in-billing-postcode').value = cityM[1];
        document.getElementById('in-billing-city').value = cityM[2];
      }
    }
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

/* ── Travel disclaimer visibility ────────────────────────────────── */
function updateTravelDisclaimer(location) {
  const disclaimer = document.getElementById('travel-disclaimer');
  disclaimer.style.display = location === 'my home' || location === 'my company' ? 'block' : 'none';
}

/* ── Billing "differs" checkbox ──────────────────────────────────── */
document.getElementById('in-billing-differs').addEventListener('change', function () {
  document.getElementById('billing-fields').style.display = this.checked ? 'block' : 'none';
});

/* ── Course type → update level options ──────────────────────────── */
document.getElementById('in-service').addEventListener('change', function () {
  const currentLevel = document.getElementById('in-level').value;
  updateLevelOptions(this.value, currentLevel);
});

/* ── Location → travel disclaimer ────────────────────────────────── */
document.getElementById('in-location').addEventListener('click', (e) => {
  const radio = e.target.closest('input[type="radio"]');
  if (!radio) return;
  setTimeout(() => {
    const loc = getRadio('location');
    if (loc) updateTravelDisclaimer(loc);
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

  const billingDiffers = document.getElementById('in-billing-differs').checked;

  const firstName = document.getElementById('in-first-name').value.trim();
  const lastName = document.getElementById('in-last-name').value.trim();
  const email = document.getElementById('in-email').value.trim();
  const phone = document.getElementById('in-phone').value.trim() || null;
  const street = document.getElementById('in-street').value.trim() || null;
  const streetNumber = document.getElementById('in-street-number').value.trim() || null;
  const postcode = document.getElementById('in-postcode').value.trim() || null;
  const city = document.getElementById('in-city').value.trim() || null;

  // Emergency contact: combine first + last name
  const ecFirst = document.getElementById('in-ec-first-name').value.trim();
  const ecLast = document.getElementById('in-ec-last-name').value.trim();
  const ecName = [ecFirst, ecLast].filter(Boolean).join(' ') || null;

  // Location and derived course_format
  const location = getRadio('location');
  const courseFormat = location === 'online' ? 'online' : location ? 'in-person' : null;

  // Billing: when same, mirror personal info
  let billingFields;
  if (billingDiffers) {
    const bFirst = document.getElementById('in-billing-first-name').value.trim();
    const bLast = document.getElementById('in-billing-last-name').value.trim();
    billingFields = {
      billing_name: [bFirst, bLast].filter(Boolean).join(' ') || null,
      billing_phone: document.getElementById('in-billing-phone').value.trim() || null,
      billing_email: document.getElementById('in-billing-email').value.trim() || null,
      billing_street: document.getElementById('in-billing-street').value.trim() || null,
      billing_street_number:
        document.getElementById('in-billing-street-number').value.trim() || null,
      billing_postcode: document.getElementById('in-billing-postcode').value.trim() || null,
      billing_city: document.getElementById('in-billing-city').value.trim() || null,
    };
  } else {
    // Mirror personal info into billing fields
    billingFields = {
      billing_name: [firstName, lastName].filter(Boolean).join(' ') || null,
      billing_phone: phone,
      billing_email: email,
      billing_street: street,
      billing_street_number: streetNumber,
      billing_postcode: postcode,
      billing_city: city,
    };
  }

  const body = {
    token: token || undefined,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    street,
    street_number: streetNumber,
    postcode,
    city,
    emergency_contact: ecName,
    ec_phone: document.getElementById('in-ec-phone').value.trim() || null,
    ec_email: document.getElementById('in-ec-email').value.trim() || null,
    ec_relationship: document.getElementById('in-ec-relationship').value.trim() || null,
    service: document.getElementById('in-service').value || null,
    current_level: document.getElementById('in-level').value || null,
    course_type: getRadio('course-size'),
    location,
    course_format: courseFormat,
    payment_method: getRadio('payment-method'),
    consent_given: true,
    ...billingFields,
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
