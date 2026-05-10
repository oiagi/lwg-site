(function () {
  const token = new URLSearchParams(window.location.search).get('token');
  const loading = document.getElementById('intake-loading');
  const content = document.getElementById('intake-content');
  const thanks = document.getElementById('intake-thanks');
  const errorState = document.getElementById('intake-error');
  const billingCheckbox = document.getElementById('if-billing-separate');
  const billingSection = document.getElementById('if-billing-section');
  const genderSelect = document.getElementById('if-gender');
  const genderNoteWrap = document.getElementById('if-gender-note-wrap');

  function setHidden(el, hidden) {
    if (el) el.classList.toggle('is-hidden', hidden);
  }

  function setErrorVisible(el, show) {
    if (el) el.classList.toggle('is-visible-block', show);
  }

  function showError() {
    setHidden(loading, true);
    setHidden(content, true);
    setHidden(errorState, false);
  }

  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v === null || v === undefined ? '' : v;
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function setBillingVisible(show) {
    billingCheckbox.checked = show;
    setHidden(billingSection, !show);
  }

  function setGenderNoteVisible(show) {
    setHidden(genderNoteWrap, !show);
    if (!show) setVal('if-gender-note', '');
  }

  billingCheckbox.addEventListener('change', (e) => {
    setBillingVisible(e.target.checked);
    if (!e.target.checked) {
      [
        'if-billing-name',
        'if-billing-email',
        'if-billing-phone',
        'if-billing-street',
        'if-billing-street-number',
        'if-billing-postcode',
        'if-billing-city',
      ].forEach((id) => showGeneratedError(id, '', false));
    }
  });

  genderSelect.addEventListener('change', (e) => {
    setGenderNoteVisible(e.target.value === 'other');
  });

  function populate(data) {
    setVal('if-first-name', data.first_name);
    setVal('if-last-name', data.last_name);
    setVal('if-gender', data.gender);
    setVal('if-gender-note', data.gender_note);
    setGenderNoteVisible(data.gender === 'other');
    setVal('if-email', data.email);
    setVal('if-phone', data.phone);
    setVal('if-street', data.street);
    setVal('if-street-number', data.street_number);
    setVal('if-postcode', data.postcode);
    setVal('if-city', data.city);

    setVal('if-ec-name', data.emergency_contact);
    setVal('if-ec-relationship', data.ec_relationship);
    setVal('if-ec-phone', data.ec_phone);
    setVal('if-ec-email', data.ec_email);

    const hasBilling = !!(
      data.billing_name ||
      data.billing_email ||
      data.billing_phone ||
      data.billing_street ||
      data.billing_postcode ||
      data.billing_city
    );
    setBillingVisible(hasBilling);
    setVal('if-billing-name', data.billing_name);
    setVal('if-billing-email', data.billing_email);
    setVal('if-billing-phone', data.billing_phone);
    setVal('if-billing-street', data.billing_street);
    setVal('if-billing-street-number', data.billing_street_number);
    setVal('if-billing-postcode', data.billing_postcode);
    setVal('if-billing-city', data.billing_city);
  }

  async function load() {
    if (!token) {
      showError();
      return;
    }
    try {
      const res = await fetch('/api/intake?token=' + encodeURIComponent(token));
      if (!res.ok) {
        showError();
        return;
      }
      const data = await res.json();
      populate(data);
      setHidden(loading, true);
      setHidden(content, false);
    } catch {
      showError();
    }
  }

  function showFieldError(id, show) {
    const el = document.getElementById(id);
    setErrorVisible(el, show);
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
    setErrorVisible(error, show);
  }

  function requireValue(id, message) {
    const missing = !getVal(id);
    showGeneratedError(id, message, missing);
    return !missing;
  }

  function requireEmail(id, message) {
    const invalid = !emailValid(getVal(id));
    showGeneratedError(id, message, invalid);
    return !invalid;
  }

  document.getElementById('intake-submit-btn').addEventListener('click', async () => {
    let valid = true;
    const firstName = getVal('if-first-name');
    showFieldError('err-first-name', !firstName);
    if (!firstName) valid = false;

    const lastName = getVal('if-last-name');
    showFieldError('err-last-name', !lastName);
    if (!lastName) valid = false;

    const gender = getVal('if-gender');
    showFieldError('err-gender', !gender);
    if (!gender) valid = false;

    const genderNote = getVal('if-gender-note');
    showFieldError('err-gender-note', gender === 'other' && !genderNote);
    if (gender === 'other' && !genderNote) valid = false;

    [
      ['if-phone', 'Please enter a phone number.'],
      ['if-street', 'Please enter a street.'],
      ['if-street-number', 'Please enter a street number.'],
      ['if-postcode', 'Please enter a postcode.'],
      ['if-city', 'Please enter a city.'],
      ['if-ec-name', 'Please enter an emergency contact name.'],
      ['if-ec-relationship', 'Please enter the emergency contact relationship.'],
      ['if-ec-phone', 'Please enter an emergency contact phone number.'],
    ].forEach(([id, message]) => {
      if (!requireValue(id, message)) valid = false;
    });
    if (!requireEmail('if-email', 'Please enter a valid email address.')) valid = false;
    if (!requireEmail('if-ec-email', 'Please enter a valid emergency contact email.')) {
      valid = false;
    }
    if (billingCheckbox.checked) {
      [
        ['if-billing-name', 'Please enter a billing name.'],
        ['if-billing-phone', 'Please enter a billing phone number.'],
        ['if-billing-street', 'Please enter a billing street.'],
        ['if-billing-street-number', 'Please enter a billing street number.'],
        ['if-billing-postcode', 'Please enter a billing postcode.'],
        ['if-billing-city', 'Please enter a billing city.'],
      ].forEach(([id, message]) => {
        if (!requireValue(id, message)) valid = false;
      });
      if (!requireEmail('if-billing-email', 'Please enter a valid billing email.')) {
        valid = false;
      }
    }

    if (!valid) {
      const first = [...document.querySelectorAll('.error')].find((e) =>
        e.classList.contains('is-visible-block')
      );
      if (first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = first.closest('.field')?.querySelector('input');
        if (input) input.focus({ preventScroll: true });
      }
      return;
    }

    const body = {
      token,
      first_name: firstName,
      last_name: lastName,
      gender: gender || null,
      gender_note: gender === 'other' ? genderNote || null : null,
      email: getVal('if-email') || null,
      phone: getVal('if-phone') || null,
      street: getVal('if-street') || null,
      street_number: getVal('if-street-number') || null,
      postcode: getVal('if-postcode') || null,
      city: getVal('if-city') || null,
      emergency_contact: getVal('if-ec-name') || null,
      ec_relationship: getVal('if-ec-relationship') || null,
      ec_phone: getVal('if-ec-phone') || null,
      ec_email: getVal('if-ec-email') || null,
      billing_separate: billingCheckbox.checked,
    };
    if (billingCheckbox.checked) {
      body.billing_name = getVal('if-billing-name') || null;
      body.billing_email = getVal('if-billing-email') || null;
      body.billing_phone = getVal('if-billing-phone') || null;
      body.billing_street = getVal('if-billing-street') || null;
      body.billing_street_number = getVal('if-billing-street-number') || null;
      body.billing_postcode = getVal('if-billing-postcode') || null;
      body.billing_city = getVal('if-billing-city') || null;
    }

    const btn = document.getElementById('intake-submit-btn');
    btn.dataset.loading = '';
    btn.disabled = true;
    document.getElementById('submit-error').classList.remove('is-visible-block');

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Server error');
      setHidden(content, true);
      setHidden(thanks, false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      delete btn.dataset.loading;
      btn.disabled = false;
      document.getElementById('submit-error').classList.add('is-visible-block');
    }
  });

  load();
})();
