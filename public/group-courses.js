import { AGB_CONSENT_HTML } from '/agb-content.js';

function renderAgbConsent() {
  const lang = window.LWG_I18N?.getLang() || document.documentElement.lang || 'en';
  document.querySelectorAll('[data-agb-consent]').forEach((el) => {
    el.innerHTML = AGB_CONSENT_HTML[lang] || AGB_CONSENT_HTML.en;
  });
  window.LWG_I18N?.localizeInternalLinks?.(document);
}

document.addEventListener('lwg:language-applied', renderAgbConsent);
renderAgbConsent();

(function () {
  const coursesList = document.getElementById('courses-list');
  const statusEl = document.getElementById('courses-status');
  const emptyState = document.getElementById('empty-state');
  const bookingPanel = document.getElementById('booking-panel');
  const bookingForm = document.getElementById('booking-form');
  const successState = document.getElementById('success-state');
  const billingCheckbox = document.getElementById('bf-billing-separate');
  const billingFields = document.getElementById('billing-fields');
  const genderSelect = document.getElementById('bf-gender');
  const genderNoteWrap = document.getElementById('bf-gender-note-wrap');
  const billingGenderSelect = document.getElementById('bf-billing-gender');
  const billingGenderNoteWrap = document.getElementById('bf-billing-gender-note-wrap');
  let courses = [];
  let selectedCourse = null;
  let statusMessageKey = 'loading';

  function lang() {
    return window.LWG_I18N?.getLang() || 'en';
  }

  function t(key) {
    return (
      window.LWG_I18N?.translateRuntime('groupCourses' + key[0].toUpperCase() + key.slice(1)) || key
    );
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleString(lang() === 'de' ? 'de-CH' : 'en-GB', {
      timeZone: 'Europe/Zurich',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function fmtPrice(course) {
    if (
      course.price_per_person_per_60min === null ||
      course.price_per_person_per_60min === undefined
    ) {
      return '';
    }
    return `${Number(course.price_per_person_per_60min).toFixed(2)} ${course.currency || 'CHF'} ${t('perPerson')}`;
  }

  function lessonSummary(course) {
    const completed = Math.max(0, Number(course.sessions_completed || 0));
    const total =
      course.sessions_total === null || course.sessions_total === undefined
        ? null
        : Math.max(0, Number(course.sessions_total));
    const remaining =
      course.sessions_remaining === null || course.sessions_remaining === undefined
        ? total === null
          ? null
          : Math.max(0, total - completed)
        : Math.max(0, Number(course.sessions_remaining));
    const completedText = `${completed} ${t('completed')}`;
    const remainingText = remaining === null ? t('openEnded') : `${remaining} ${t('remaining')}`;
    return `${completedText} · ${remainingText}`;
  }

  function renderCourses() {
    statusEl.textContent = '';
    statusEl.hidden = true;
    emptyState.hidden = courses.length > 0;
    coursesList.innerHTML = courses
      .map((course) => {
        const spotsLabel = course.spots_remaining === 1 ? t('spot') : t('spots');
        const price = fmtPrice(course);
        return `<article class="course-item">
          <div class="course-item__main">
            <p class="course-meta">${esc(course.service || 'group course')}</p>
            <h2>${esc(course.level || '-')}</h2>
            <dl class="course-facts">
              <div><dt>${t('nextLesson')}</dt><dd>${esc(fmtDate(course.first_session_at))}</dd></div>
              <div><dt>${t('lessons')}</dt><dd>${esc(lessonSummary(course))}</dd></div>
              <div><dt>${t('place')}</dt><dd>${esc(course.location_text || '-')}</dd></div>
              <div><dt>${t('spots')}</dt><dd>${course.spots_remaining} ${spotsLabel} ${t('available')}</dd></div>
            </dl>
          </div>
          <div class="course-item__side">
            ${price ? `<p class="course-price">${esc(price)}</p>` : ''}
            <p class="course-note">${t('maxPeople')}</p>
            <button type="button" class="course-book-btn" data-course-id="${esc(course.id)}">${t('book')}</button>
          </div>
        </article>`;
      })
      .join('');
  }

  async function loadCourses() {
    statusEl.hidden = false;
    statusMessageKey = 'loading';
    statusEl.textContent = t('loading');
    try {
      const res = await fetch('/api/public-courses');
      if (!res.ok) throw new Error('load failed');
      courses = await res.json();
      renderCourses();
    } catch {
      courses = [];
      emptyState.hidden = true;
      statusEl.hidden = false;
      statusMessageKey = 'loadError';
      statusEl.textContent = t('loadError');
    }
  }

  function setSelectedCourse(course) {
    selectedCourse = course;
    document.getElementById('booking-course-id').value = course.id;
    document.getElementById('booking-title').textContent =
      `${t('selected')}: ${course.level || ''}`;
    document.getElementById('booking-note').textContent =
      `${course.service || 'Group course'} - ${fmtDate(course.first_session_at)} - ${course.location_text}.`;
    bookingPanel.hidden = false;
    successState.hidden = true;
    bookingPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function val(id) {
    return document.getElementById(id).value.trim();
  }

  function showErr(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('is-visible-block', show);
  }

  function emailValid(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function showGeneratedError(id, message, show) {
    const input = document.getElementById(id);
    if (!input) return;
    let error = document.getElementById(`err-${id}`);
    if (!error) {
      error = document.createElement('div');
      error.className = 'error';
      error.id = `err-${id}`;
      input.insertAdjacentElement('afterend', error);
    }
    error.textContent = message;
    error.classList.toggle('is-visible-block', show);
    input.setAttribute('aria-invalid', show ? 'true' : 'false');
    if (show) {
      input.setAttribute('aria-describedby', `err-${id}`);
    } else {
      input.removeAttribute('aria-describedby');
    }
  }

  function requireValue(id, message) {
    const missing = !val(id);
    showGeneratedError(id, message, missing);
    return !missing;
  }

  function requireEmail(id, message) {
    const invalid = !emailValid(val(id));
    showGeneratedError(id, message, invalid);
    return !invalid;
  }

  function buildStudentPayload() {
    const student = {
      first_name: val('bf-first-name'),
      last_name: val('bf-last-name'),
      gender: val('bf-gender') || null,
      gender_note: val('bf-gender-note') || null,
      email: val('bf-email'),
      phone: val('bf-phone') || null,
      street: val('bf-street') || null,
      street_number: val('bf-street-number') || null,
      postcode: val('bf-postcode') || null,
      city: val('bf-city') || null,
      emergency_contact: val('bf-ec-name') || null,
      ec_relationship: val('bf-ec-relationship') || null,
      ec_phone: val('bf-ec-phone') || null,
      ec_email: val('bf-ec-email') || null,
      billing_separate: billingCheckbox.checked,
      consent_given: document.getElementById('bf-consent').checked,
    };
    if (billingCheckbox.checked) {
      student.billing_name = val('bf-billing-name') || null;
      student.billing_gender = val('bf-billing-gender') || null;
      student.billing_gender_note =
        student.billing_gender === 'other' ? val('bf-billing-gender-note') || null : null;
      student.billing_email = val('bf-billing-email') || null;
      student.billing_phone = val('bf-billing-phone') || null;
      student.billing_street = val('bf-billing-street') || null;
      student.billing_street_number = val('bf-billing-street-number') || null;
      student.billing_postcode = val('bf-billing-postcode') || null;
      student.billing_city = val('bf-billing-city') || null;
    }
    return student;
  }

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedCourse) return;

    const firstName = val('bf-first-name');
    const lastName = val('bf-last-name');
    const gender = val('bf-gender');
    const genderNote = val('bf-gender-note');
    const email = val('bf-email');
    const consent = document.getElementById('bf-consent').checked;
    const requiredFields = [
      ['bf-phone', 'Please enter a phone number.'],
      ['bf-street', 'Please enter a street.'],
      ['bf-street-number', 'Please enter a street number.'],
      ['bf-postcode', 'Please enter a postcode.'],
      ['bf-city', 'Please enter a city.'],
      ['bf-ec-name', 'Please enter an emergency contact name.'],
      ['bf-ec-relationship', 'Please enter the emergency contact relationship.'],
      ['bf-ec-phone', 'Please enter an emergency contact phone number.'],
    ];

    let valid = true;
    showErr('err-first-name', !firstName);
    if (!firstName) valid = false;
    showErr('err-last-name', !lastName);
    if (!lastName) valid = false;
    showErr('err-gender', !gender);
    if (!gender) valid = false;
    showErr('err-gender-note', gender === 'other' && !genderNote);
    if (gender === 'other' && !genderNote) valid = false;
    showErr('err-email', !emailValid(email));
    if (!emailValid(email)) valid = false;
    requiredFields.forEach(([id, message]) => {
      if (!requireValue(id, message)) valid = false;
    });
    if (!requireEmail('bf-ec-email', 'Please enter a valid emergency contact email.')) {
      valid = false;
    }
    if (billingCheckbox.checked) {
      [
        ['bf-billing-name', 'Please enter a billing name.'],
        ['bf-billing-gender', 'Please select a billing salutation.'],
        ['bf-billing-phone', 'Please enter a billing phone number.'],
        ['bf-billing-street', 'Please enter a billing street.'],
        ['bf-billing-street-number', 'Please enter a billing street number.'],
        ['bf-billing-postcode', 'Please enter a billing postcode.'],
        ['bf-billing-city', 'Please enter a billing city.'],
      ].forEach(([id, message]) => {
        if (!requireValue(id, message)) valid = false;
      });
      if (!requireEmail('bf-billing-email', 'Please enter a valid billing email.')) {
        valid = false;
      }
      if (val('bf-billing-gender') === 'other') {
        if (!requireValue('bf-billing-gender-note', 'Please specify the billing salutation.')) {
          valid = false;
        }
      } else {
        showGeneratedError('bf-billing-gender-note', '', false);
      }
    }
    showErr('err-consent', !consent);
    if (!consent) valid = false;

    if (!valid) {
      const first = [...document.querySelectorAll('.error')].find((el) =>
        el.classList.contains('is-visible-block')
      );
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const btn = document.getElementById('booking-submit');
    const errorEl = document.getElementById('booking-error');
    errorEl.classList.remove('is-visible-block');
    btn.disabled = true;
    btn.dataset.loading = '';
    btn.textContent = t('submitting');

    try {
      const res = await fetch('/api/book-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: selectedCourse.id,
          language: lang(),
          student: buildStudentPayload(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(res.status === 409 ? t('unavailable') : body.error || t('serverError'));
      }
      bookingPanel.hidden = true;
      successState.hidden = false;
      successState.querySelector('h2').textContent = t('successTitle');
      successState.querySelector('p').textContent = t('successBody');
      successState.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await loadCourses();
    } catch (err) {
      errorEl.textContent = err.message || t('serverError');
      errorEl.classList.add('is-visible-block');
    } finally {
      delete btn.dataset.loading;
      btn.disabled = false;
      btn.textContent = t('book');
    }
  });

  coursesList.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-course-id]');
    if (!btn) return;
    const course = courses.find((item) => item.id === btn.dataset.courseId);
    if (course) setSelectedCourse(course);
  });

  billingCheckbox.addEventListener('change', () => {
    billingFields.hidden = !billingCheckbox.checked;
    if (!billingCheckbox.checked) {
      [
        'bf-billing-name',
        'bf-billing-gender',
        'bf-billing-gender-note',
        'bf-billing-email',
        'bf-billing-phone',
        'bf-billing-street',
        'bf-billing-street-number',
        'bf-billing-postcode',
        'bf-billing-city',
      ].forEach((id) => showGeneratedError(id, '', false));
    }
  });

  genderSelect.addEventListener('change', () => {
    const needsNote = genderSelect.value === 'other';
    genderNoteWrap.hidden = !needsNote;
    if (!needsNote) document.getElementById('bf-gender-note').value = '';
  });

  billingGenderSelect.addEventListener('change', () => {
    const needsNote = billingGenderSelect.value === 'other';
    billingGenderNoteWrap.hidden = !needsNote;
    if (!needsNote) document.getElementById('bf-billing-gender-note').value = '';
  });

  document.getElementById('booking-cancel').addEventListener('click', () => {
    bookingPanel.hidden = true;
    selectedCourse = null;
  });

  document.addEventListener('lwg:language-applied', () => {
    if (!statusEl.hidden) statusEl.textContent = courses.length ? '' : t(statusMessageKey);
    emptyState.querySelector('p').textContent = t('noSpots');
    emptyState.querySelector('a').textContent = t('enquiry');
    document.getElementById('booking-submit').textContent = t('book');
    if (selectedCourse) setSelectedCourse(selectedCourse);
    if (courses.length) renderCourses();
  });

  loadCourses();
})();
