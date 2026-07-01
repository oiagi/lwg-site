/* ── Edit course page ─────────────────────────────────────────────── */
import { initAuth, getSession } from '../core/auth.js';
import { apiFetch } from '../core/api.js';

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v ?? '';
}

const SUFFIXABLE_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const DEFAULT_PRICE_PER_PERSON = {
  private: 120,
  duo: 70,
  group: 50,
};

function splitLevel(raw) {
  const v = (raw || '').trim();
  const suffix = v.match(/(\.[123]|\+)$/)?.[0] || '';
  if (suffix) {
    const base = v.slice(0, -suffix.length);
    if (SUFFIXABLE_LEVELS.has(base)) return { base, suffix };
  }
  return { base: v, suffix: '' };
}

function syncSuffixEnabled(baseId, suffixId) {
  const baseEl = document.getElementById(baseId);
  const suffixEl = document.getElementById(suffixId);
  if (!baseEl || !suffixEl) return;
  const enabled = SUFFIXABLE_LEVELS.has(baseEl.value);
  suffixEl.disabled = !enabled;
  if (!enabled) suffixEl.value = '';
}

function fillDefaultPerPersonPrice() {
  const groupType = document.getElementById('ec-group')?.value;
  const priceEl = document.getElementById('ec-price-person');
  if (!priceEl || priceEl.value) return;
  priceEl.value = DEFAULT_PRICE_PER_PERSON[groupType] ?? '';
}

function hasLocationAddress() {
  return ['ec-loc-company', 'ec-loc-street', 'ec-loc-number', 'ec-loc-postal', 'ec-loc-city'].some(
    (id) => document.getElementById(id)?.value.trim()
  );
}

function setAddressFieldsOpen(open) {
  const fields = document.getElementById('ec-address-fields');
  const toggle = document.getElementById('ec-toggle-address');
  if (!fields || !toggle) return;
  fields.classList.toggle('is-hidden', !open);
  toggle.textContent = open ? '− hide address' : '+ add address';
}

let companiesData = [];

function populateCompanyDropdown(companies, selectedCompanyId) {
  const select = document.getElementById('ec-company-id');
  if (!select) return;
  companiesData = companies;
  select.innerHTML =
    `<option value="">— none —</option>` +
    companies
      .map((c) => {
        const label = c.name + (c.booking_code ? ' · ' + c.booking_code : ' (no code)');
        return `<option value="${c.id}"${String(c.id) === String(selectedCompanyId) ? ' selected' : ''}>${label}</option>`;
      })
      .join('');
  syncCompanyFields();
}

function syncCompanyFields() {
  const select = document.getElementById('ec-company-id');
  const hint = document.getElementById('ec-company-code-hint');
  const customCode = document.getElementById('ec-custom-code-field');
  const customLabel = document.getElementById('ec-custom-label-field');
  if (!select) return;

  const companyId = select.value;
  const company = companiesData.find((c) => String(c.id) === companyId);
  const hasCompany = !!company;

  if (customCode) customCode.classList.toggle('is-hidden', hasCompany);
  if (customLabel) customLabel.classList.toggle('is-hidden', hasCompany);

  if (hint) {
    if (hasCompany) {
      hint.textContent = company.booking_code
        ? `Booking code: ${company.booking_code} (auto-synced from company)`
        : 'No booking code set for this company yet — add one in the Companies tab.';
    } else {
      hint.textContent = '';
    }
  }
}

function populate(course) {
  document.getElementById('ec-id').value = course.id;
  document.getElementById('ec-code-label').textContent = course.course_code
    ? 'Course code: ' + course.course_code
    : '';
  setVal('ec-course-type', course.course_type || 'language course');
  setVal('ec-subject', course.subject || 'German');
  const { base, suffix } = splitLevel(course.level);
  setVal('ec-level', base);
  setVal('ec-level-suffix', suffix);
  syncSuffixEnabled('ec-level', 'ec-level-suffix');
  setVal('ec-group', course.group_type || 'private');
  setVal('ec-status', course.status || 'active');
  setVal(
    'ec-sessions',
    course.sessions_total !== null && course.sessions_total !== undefined
      ? course.sessions_total
      : ''
  );
  setVal('ec-session-length', course.session_length_minutes || '');
  setVal(
    'ec-price',
    course.price_per_session !== null && course.price_per_session !== undefined
      ? course.price_per_session
      : ''
  );
  setVal(
    'ec-price-person',
    course.price_per_person_per_60min !== null && course.price_per_person_per_60min !== undefined
      ? course.price_per_person_per_60min
      : ''
  );
  setVal('ec-currency', course.currency || 'CHF');
  setVal('ec-location', course.location || '');
  setVal('ec-loc-company', course.location_company || '');
  setVal('ec-loc-street', course.location_street || '');
  setVal('ec-loc-number', course.location_street_number || '');
  setVal('ec-loc-postal', course.location_postal_code || '');
  setVal('ec-loc-city', course.location_city || '');
  document.getElementById('ec-public-booking').checked = course.public_booking_enabled === true;
  document.getElementById('ec-company-code-booking').checked =
    course.company_code_booking_enabled === true;

  // Company dropdown — populated separately; just set the custom code fallback values
  setVal('ec-access-code', course.access_code || '');
  setVal('ec-access-label', course.access_label || '');

  // Pre-select company in dropdown if already set
  const companySelect = document.getElementById('ec-company-id');
  if (companySelect && course.company_id) {
    companySelect.value = String(course.company_id);
  }
  syncCompanyFields();

  setAddressFieldsOpen(hasLocationAddress());
}

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('ec-submit');
  const msgEl = document.getElementById('ec-msg');
  msgEl.classList.remove('is-visible-block');

  const courseId = document.getElementById('ec-id').value;
  if (!courseId) return;

  const sessionsVal = document.getElementById('ec-sessions').value;
  const lengthVal = document.getElementById('ec-session-length').value;
  const priceVal = document.getElementById('ec-price').value;
  const pricePersonVal = document.getElementById('ec-price-person').value;
  const companyCodeBookingEnabled =
    document.getElementById('ec-company-code-booking')?.checked || false;

  const companyId = document.getElementById('ec-company-id')?.value || null;
  const accessCode = companyId
    ? null
    : document.getElementById('ec-access-code').value.trim() || null;

  if (companyCodeBookingEnabled && !companyId && !accessCode) {
    msgEl.textContent = 'Please link a company or enter a custom booking code.';
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    return;
  }

  const body = {
    course_id: courseId,
    course_type: document.getElementById('ec-course-type').value,
    subject: document.getElementById('ec-subject').value,
    level:
      document.getElementById('ec-level').value +
        (document.getElementById('ec-level-suffix').value || '') || null,
    group_type: document.getElementById('ec-group').value,
    status: document.getElementById('ec-status').value,
    sessions_total: sessionsVal === '' ? null : parseInt(sessionsVal, 10),
    session_length_minutes: lengthVal === '' ? null : parseInt(lengthVal, 10),
    price_per_session: priceVal === '' ? null : parseFloat(priceVal),
    price_per_person_per_60min: pricePersonVal === '' ? null : parseFloat(pricePersonVal),
    currency: document.getElementById('ec-currency').value || 'CHF',
    location: document.getElementById('ec-location').value || null,
    location_company: document.getElementById('ec-loc-company').value.trim() || null,
    location_street: document.getElementById('ec-loc-street').value.trim() || null,
    location_street_number: document.getElementById('ec-loc-number').value.trim() || null,
    location_postal_code: document.getElementById('ec-loc-postal').value.trim() || null,
    location_city: document.getElementById('ec-loc-city').value.trim() || null,
    public_booking_enabled: document.getElementById('ec-public-booking')?.checked || false,
    company_code_booking_enabled: companyCodeBookingEnabled,
    company_id: companyId || null,
  };

  // Only send manual access_code/label when no company is linked
  if (!companyId) {
    body.access_code = accessCode;
    body.access_label = document.getElementById('ec-access-label').value.trim() || null;
  }

  btn.textContent = 'saving…';
  btn.disabled = true;

  try {
    const res = await apiFetch('/api/update-course', { method: 'PATCH', body });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Unknown error');

    msgEl.textContent = 'Course updated.';
    msgEl.className = 'modal-msg success';
    msgEl.classList.add('is-visible-block');
    btn.textContent = 'saved';

    setTimeout(() => {
      window.location.href = '/admin#courses';
    }, 1500);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.className = 'modal-msg err';
    msgEl.classList.add('is-visible-block');
    btn.textContent = 'save changes';
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
  if (!id) {
    window.location.href = '/admin#courses';
    return;
  }

  try {
    const [coursesRes, companiesRes] = await Promise.all([
      apiFetch('/api/get-courses?status=all'),
      apiFetch('/api/get-companies'),
    ]);
    if (!coursesRes.ok) throw new Error();
    const courses = await coursesRes.json();
    const course = courses.find((c) => c.id === id);
    if (!course) throw new Error('Course not found');

    const companies = companiesRes.ok ? await companiesRes.json() : [];
    populateCompanyDropdown(companies, course.company_id);
    populate(course);
  } catch {
    document.getElementById('page-loading').innerHTML =
      '<p class="loading-state">Could not load course.</p>';
    return;
  }

  document.getElementById('course-edit-form').addEventListener('submit', handleSubmit);
  document.getElementById('ec-group').addEventListener('change', fillDefaultPerPersonPrice);
  document
    .getElementById('ec-level')
    .addEventListener('change', () => syncSuffixEnabled('ec-level', 'ec-level-suffix'));
  document.getElementById('ec-toggle-address').addEventListener('click', () => {
    const fields = document.getElementById('ec-address-fields');
    setAddressFieldsOpen(fields?.classList.contains('is-hidden'));
  });
  document.getElementById('ec-company-id')?.addEventListener('change', syncCompanyFields);

  document.getElementById('page-loading').classList.add('is-hidden');
  document.getElementById('page-content').classList.remove('is-hidden');
})();
