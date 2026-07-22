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
  const accessCodePanel = document.getElementById('access-code-panel');
  const accessCodeToggle = document.getElementById('access-code-toggle');
  const accessCodeForm = document.getElementById('access-code-form');
  const accessCodeInput = document.getElementById('access-code-input');
  const accessCodeSubmit = document.getElementById('access-code-submit');
  const accessCodeStatus = document.getElementById('access-code-status');
  const bookingPanel = document.getElementById('booking-panel');
  const bookingForm = document.getElementById('booking-form');
  const successState = document.getElementById('success-state');
  const plannedSlotFields = document.getElementById('planned-slot-fields');
  const reducedLessonsField = document.getElementById('reduced-lessons-field');
  const reducedLessonsHint = document.getElementById('reduced-lessons-hint');
  const preferredLevelSelect = document.getElementById('bf-preferred-level');
  const preferredLocationSelect = document.getElementById('bf-preferred-location');
  const billingCheckbox = document.getElementById('bf-billing-separate');
  const billingFields = document.getElementById('billing-fields');
  const genderSelect = document.getElementById('bf-gender');
  const genderNoteWrap = document.getElementById('bf-gender-note-wrap');
  const billingGenderSelect = document.getElementById('bf-billing-gender');
  const billingGenderNoteWrap = document.getElementById('bf-billing-gender-note-wrap');
  let courses = [];
  let selectedCourse = null;
  let statusMessageKey = 'loading';
  let accessStatus = null;

  const fallbackText = {
    codeTitle: 'company booking code',
    codeCopy: 'Have a code from your company? Enter it here to see your group booking options.',
    codePlaceholder: 'booking code',
    unlock: 'unlock',
    unlocking: 'unlocking...',
    codeRequired: 'Please enter your booking code.',
    codeInvalid: 'No group booking options were found for this code.',
    codeUnlocked: (count) => `${count} company booking option${count === 1 ? '' : 's'} unlocked.`,
    codeUnlockedLabel: (label, count) =>
      `${count} booking option${count === 1 ? '' : 's'} unlocked for ${label}.`,
    companyOption: 'company booking option',
  };

  function lang() {
    return window.LWG_I18N?.getLang() || 'en';
  }

  function t(key, ...args) {
    const runtimeKey = 'groupCourses' + key[0].toUpperCase() + key.slice(1);
    const translated = window.LWG_I18N?.translateRuntime(runtimeKey, ...args);
    if (translated && translated !== runtimeKey) return translated;
    const fallback = fallbackText[key];
    return typeof fallback === 'function' ? fallback(...args) : fallback || key;
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

  function courseKind(course) {
    return course.kind === 'planned_slot' ? 'planned_slot' : 'existing_course';
  }

  function isProtectedCourse(course) {
    return course.access_code_required === true;
  }

  function scheduleText(course) {
    if (courseKind(course) === 'planned_slot') return course.schedule_text || t('weeklySlot');
    return fmtDate(course.first_session_at);
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
    if (courseKind(course) === 'planned_slot') {
      const total =
        course.sessions_total === null || course.sessions_total === undefined
          ? null
          : Math.max(0, Number(course.sessions_total));
      return total === null ? t('openEnded') : String(total);
    }

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

  function lessonLabel(course) {
    return courseKind(course) === 'planned_slot' ? t('numberOfLessons') : t('lessons');
  }

  function renderCourses() {
    statusEl.textContent = '';
    statusEl.hidden = true;
    emptyState.hidden = courses.length > 0;
    coursesList.innerHTML = courses
      .map((course, index) => {
        const spotsLabel = course.spots_remaining === 1 ? t('spot') : t('spots');
        const price = fmtPrice(course);
        const isSlot = courseKind(course) === 'planned_slot';
        const isUnlocked = !!course.unlocked_access_code;
        const itemClasses = ['course-item'];
        if (isUnlocked) itemClasses.push('course-item--unlocked');
        if (isUnlocked && index === 0) itemClasses.push('course-item--access-highlight');
        const accessBadge = isProtectedCourse(course)
          ? `<span class="course-access-badge">${esc(course.access_label || t('companyOption'))}</span>`
          : '';
        const placeFact = isSlot
          ? ''
          : `<div><dt>${t('place')}</dt><dd>${esc(course.location_text || '-')}</dd></div>`;
        const spotsFact = isSlot
          ? ''
          : `<div><dt>${t('spots')}</dt><dd>${course.spots_remaining} ${spotsLabel} ${t('available')}</dd></div>`;
        return `<article class="${itemClasses.join(' ')}">
          <div class="course-item__main">
            <p class="course-meta">${esc(isSlot ? t('formingCourse') : course.service || 'group course')}</p>
            <h2>${esc(course.level || (isSlot ? t('chooseLevel') : '-'))}${accessBadge}</h2>
            <dl class="course-facts">
              <div><dt>${isSlot ? t('timeSlot') : t('nextLesson')}</dt><dd>${esc(scheduleText(course))}</dd></div>
              <div><dt>${lessonLabel(course)}</dt><dd>${esc(lessonSummary(course))}</dd></div>
              ${placeFact}
              ${spotsFact}
            </dl>
          </div>
          <div class="course-item__side">
            ${price ? `<p class="course-price">${esc(price)}</p>` : ''}
            <p class="course-note">${isSlot ? t('startsWhenReady') : t('maxPeople')}</p>
            <button type="button" class="course-book-btn" data-course-id="${esc(course.id)}">${isSlot ? t('registerInterest') : t('book')}</button>
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

  function renderAccessStatus() {
    if (!accessCodeStatus) return;
    accessCodeStatus.classList.toggle('is-error', accessStatus?.type === 'error');
    accessCodeStatus.classList.toggle('is-success', accessStatus?.type === 'success');
    accessCodeStatus.textContent = accessStatus?.message || '';
  }

  function syncAccessCodeExpanded(shouldFocus = false) {
    if (!accessCodePanel || !accessCodeToggle) return;
    const isExpanded = accessCodePanel.open === true;
    accessCodeToggle.setAttribute('aria-expanded', String(isExpanded));
    accessCodePanel?.classList.toggle('is-expanded', isExpanded);
    if (isExpanded && shouldFocus) requestAnimationFrame(() => accessCodeInput?.focus());
  }

  async function unlockAccessCode(code) {
    const res = await fetch('/api/group-course-access-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || t('codeInvalid'));
    return body;
  }

  function mergeUnlockedCourses(unlocked) {
    const accessCode = unlocked.access_code;
    const unlockedCourses = (unlocked.courses || []).map((course) => ({
      ...course,
      unlocked_access_code: accessCode,
    }));
    const unlockedIds = new Set(unlockedCourses.map((course) => course.id));
    courses = [...unlockedCourses, ...courses.filter((course) => !unlockedIds.has(course.id))];
    renderCourses();
    return unlockedCourses.length;
  }

  function applyAccessCodeText() {
    document.getElementById('access-code-title').textContent = t('codeTitle');
    document.getElementById('access-code-copy').textContent = t('codeCopy');
    document.getElementById('access-code-input').placeholder = t('codePlaceholder');
    document.getElementById('access-code-submit').textContent = t('unlock');
  }

  function setSelectedCourse(course) {
    selectedCourse = course;
    document.getElementById('booking-course-id').value = course.id;
    const isSlot = courseKind(course) === 'planned_slot';
    document.getElementById('booking-title').textContent =
      `${isSlot ? t('selectedSlot') : t('selected')}: ${course.level || t('chooseLevel')}`;
    document.getElementById('booking-note').textContent = isSlot
      ? `${course.service || 'Group course'} - ${scheduleText(course)} - ${t('chooseLevel')} / ${t('chooseLocation')}.`
      : `${course.service || 'Group course'} - ${scheduleText(course)} - ${course.location_text}.`;
    plannedSlotFields.hidden = !isSlot;
    if (isSlot) {
      preferredLevelSelect.value = '';
      preferredLocationSelect.value = [...preferredLocationSelect.options].some(
        (option) => option.value === course.location
      )
        ? course.location
        : '';
    }
    reducedLessonsField.hidden = !(isSlot && course.allow_reduced_lessons);
    if (isSlot && course.allow_reduced_lessons) {
      const one = course.reduced_lessons_if_one;
      const two = course.reduced_lessons_if_two;
      const full = course.sessions_total;
      reducedLessonsHint.textContent =
        one && two && full
          ? t('reducedLessonsHintDetail', full, two, one)
          : t('reducedLessonsHint');
    }
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

  // Empty is accepted; a filled-in value still has to look like an email.
  function optionalEmail(id, message) {
    const value = val(id);
    const invalid = Boolean(value) && !emailValid(value);
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
    if (!optionalEmail('bf-ec-email', 'Please enter a valid emergency contact email.')) {
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
    if (courseKind(selectedCourse) === 'planned_slot') {
      const missingLevel = !val('bf-preferred-level');
      const missingLocation = !val('bf-preferred-location');
      showErr('err-preferred-level', missingLevel);
      showErr('err-preferred-location', missingLocation);
      if (missingLevel || missingLocation) valid = false;
      if (selectedCourse.allow_reduced_lessons) {
        const missingReducedChoice = !val('bf-reduced-lessons-ok');
        showErr('err-reduced-lessons-ok', missingReducedChoice);
        if (missingReducedChoice) valid = false;
      } else {
        showErr('err-reduced-lessons-ok', false);
      }
    } else {
      showErr('err-preferred-level', false);
      showErr('err-preferred-location', false);
      showErr('err-reduced-lessons-ok', false);
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
          ...(courseKind(selectedCourse) === 'planned_slot'
            ? { slot_id: selectedCourse.id }
            : { course_id: selectedCourse.id }),
          access_code: selectedCourse.access_code_required
            ? selectedCourse.unlocked_access_code || null
            : null,
          language: lang(),
          preferred_start_date:
            courseKind(selectedCourse) === 'planned_slot'
              ? val('bf-preferred-start-date') || null
              : null,
          preferred_level:
            courseKind(selectedCourse) === 'planned_slot'
              ? val('bf-preferred-level') || null
              : null,
          preferred_location:
            courseKind(selectedCourse) === 'planned_slot'
              ? val('bf-preferred-location') || null
              : null,
          reduced_lessons_ok:
            courseKind(selectedCourse) === 'planned_slot' && selectedCourse.allow_reduced_lessons
              ? val('bf-reduced-lessons-ok') === 'yes'
              : null,
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

  accessCodePanel?.addEventListener('toggle', () => {
    syncAccessCodeExpanded();
  });

  accessCodeToggle?.addEventListener('click', () => {
    if (accessCodePanel?.open === false) {
      requestAnimationFrame(() => syncAccessCodeExpanded(true));
    }
  });

  accessCodeForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = accessCodeInput.value.trim();
    if (!code) {
      accessStatus = { type: 'error', message: t('codeRequired') };
      renderAccessStatus();
      return;
    }

    accessCodeSubmit.disabled = true;
    accessCodeSubmit.dataset.loading = '';
    accessCodeSubmit.textContent = t('unlocking');
    accessStatus = null;
    renderAccessStatus();

    try {
      const unlocked = await unlockAccessCode(code);
      const count = mergeUnlockedCourses(unlocked);
      accessCodeInput.value = '';
      accessStatus = {
        type: 'success',
        message:
          unlocked.access_label && count
            ? t('codeUnlockedLabel', unlocked.access_label, count)
            : t('codeUnlocked', count),
      };
    } catch (err) {
      accessStatus = { type: 'error', message: err.message || t('codeInvalid') };
    } finally {
      delete accessCodeSubmit.dataset.loading;
      accessCodeSubmit.disabled = false;
      accessCodeSubmit.textContent = t('unlock');
      renderAccessStatus();
    }
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
    applyAccessCodeText();
    renderAccessStatus();
    if (selectedCourse) setSelectedCourse(selectedCourse);
    if (courses.length) renderCourses();
  });

  applyAccessCodeText();
  syncAccessCodeExpanded();

  const prefilledCode = new URLSearchParams(window.location.search).get('code');
  if (prefilledCode && accessCodeInput) {
    accessCodeInput.value = prefilledCode;
  }

  loadCourses().then(async () => {
    if (!prefilledCode) return;
    try {
      const unlocked = await unlockAccessCode(prefilledCode);
      const count = mergeUnlockedCourses(unlocked);
      accessStatus = {
        type: 'success',
        message:
          unlocked.access_label && count
            ? t('codeUnlockedLabel', unlocked.access_label, count)
            : t('codeUnlocked', count),
      };
      if (accessCodePanel) {
        accessCodePanel.open = true;
        syncAccessCodeExpanded();
      }
    } catch (err) {
      accessStatus = { type: 'error', message: err.message || t('codeInvalid') };
    } finally {
      renderAccessStatus();
    }
  });
})();
