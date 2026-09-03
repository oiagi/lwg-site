// public/call-booking.js
// The "book a 15min call" panel in the homepage #enquiry section.
//
// Slot times come from /api/call-slots already resolved to Europe/Zurich, and
// the labels are rendered verbatim so a visitor abroad still sees the same
// times Gioia does. State is kept as keys rather than rendered strings, so a
// language switch mid-flow just re-runs the render functions.

import { AGB_CONSENT_HTML } from '/agb-content.js';

function renderAgbConsent() {
  const lang = window.LWG_I18N?.getLang() || document.documentElement.lang || 'en';
  document.querySelectorAll('#call-panel [data-agb-consent]').forEach((el) => {
    el.innerHTML = AGB_CONSENT_HTML[lang] || AGB_CONSENT_HTML.en;
  });
  window.LWG_I18N?.localizeInternalLinks?.(document);
}

(function () {
  const trigger = document.getElementById('closing-cta-call');
  const panel = document.getElementById('call-panel');
  if (!trigger || !panel) return;

  const title = document.getElementById('call-panel-title');
  const closeBtn = document.getElementById('call-cancel');
  const statusEl = document.getElementById('call-status');
  const daysEl = document.getElementById('call-days');
  const form = document.getElementById('call-form');
  const selectedEl = document.getElementById('call-selected');
  const successEl = document.getElementById('call-success');
  const successBody = document.getElementById('call-success-body');
  const submitBtn = document.getElementById('cb-submit');

  let days = [];
  let selectedSlot = null;
  let statusKey = 'loading';
  let success = null; // { when, delivery, meetLink }
  let loaded = false;

  const fallback = {
    callLoading: 'loading available times…',
    callLoadError: 'Available times could not be loaded right now.',
    callNoSlots: 'No free slots in the next three weeks.',
    callEnquiryLink: 'make an enquiry →',
    callSelected: (date, time) => `Selected: ${date} at ${time} (Zürich time)`,
    callChooseSlot: 'Please choose a time first.',
    callSubmitting: 'booking…',
    callSubmit: 'book the call',
    callTaken: 'That time was just taken. Please choose another one.',
    callServerError: 'Something went wrong. Please try again later.',
    callSuccessMeet: (when) =>
      `We've emailed you a calendar invitation with the video link. See you on ${when}.`,
    callSuccessEmail: (when) => `We've emailed you the details for ${when}. See you then!`,
  };

  function lang() {
    return window.LWG_I18N?.getLang() || 'en';
  }

  function t(key, ...args) {
    const translated = window.LWG_I18N?.translateRuntime?.(key, ...args);
    if (translated) return translated;
    const fb = fallback[key];
    return typeof fb === 'function' ? fb(...args) : fb || '';
  }

  function esc(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function val(id) {
    return document.getElementById(id).value.trim();
  }

  function showErr(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('is-visible-block', show);
  }

  function markInvalid(inputId, errorId, invalid) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (invalid) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorId);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
    showErr(errorId, invalid);
  }

  function emailValid(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function formatDay(iso) {
    return new Date(iso).toLocaleDateString(lang() === 'de' ? 'de-CH' : 'en-GB', {
      timeZone: 'Europe/Zurich',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  function renderStatus() {
    if (!statusKey) {
      statusEl.hidden = true;
      return;
    }
    statusEl.hidden = false;
    if (statusKey === 'empty' || statusKey === 'error') {
      const href = window.LWG_I18N?.href?.('/enquiry.html') || '/enquiry';
      statusEl.innerHTML = `${esc(t(statusKey === 'empty' ? 'callNoSlots' : 'callLoadError'))} <a href="${esc(href)}">${esc(t('callEnquiryLink'))}</a>`;
    } else {
      statusEl.textContent = t('callLoading');
    }
  }

  function renderDays() {
    if (!days.length) {
      daysEl.hidden = true;
      daysEl.innerHTML = '';
      return;
    }
    daysEl.hidden = false;
    daysEl.innerHTML = days
      .map(
        (d) => `
        <div class="call-day">
          <p class="call-day__date">${esc(formatDay(d.slots[0].start))}</p>
          <div class="call-day__slots">
            ${d.slots
              .map(
                (s) =>
                  `<button type="button" class="call-slot" data-start="${esc(s.start)}" aria-pressed="${
                    selectedSlot?.start === s.start ? 'true' : 'false'
                  }">${esc(s.time)}</button>`
              )
              .join('')}
          </div>
        </div>`
      )
      .join('');
  }

  function renderSelected() {
    if (!selectedSlot) {
      form.hidden = true;
      selectedEl.textContent = '';
      return;
    }
    form.hidden = false;
    selectedEl.textContent = t('callSelected', formatDay(selectedSlot.start), selectedSlot.time);
  }

  function renderSuccess() {
    if (!success) {
      successEl.hidden = true;
      return;
    }
    successEl.hidden = false;
    const key = success.meetLink ? 'callSuccessMeet' : 'callSuccessEmail';
    successBody.textContent = t(key, success.when);
  }

  function renderSubmitLabel() {
    if (!submitBtn.disabled) submitBtn.textContent = t('callSubmit');
  }

  function renderAll() {
    renderAgbConsent();
    renderStatus();
    renderDays();
    renderSelected();
    renderSuccess();
    renderSubmitLabel();
  }

  // ── Load ────────────────────────────────────────────────────────────────

  async function loadSlots() {
    statusKey = 'loading';
    renderStatus();
    try {
      const res = await fetch('/api/call-slots');
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      days = data.days || [];
      statusKey = days.length ? null : 'empty';
    } catch {
      days = [];
      statusKey = 'error';
    }
    renderStatus();
    renderDays();
  }

  // ── Panel open/close ────────────────────────────────────────────────────

  function openPanel() {
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (!loaded) {
      loaded = true;
      loadSlots();
    }
    title.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // The nav's "book a call" entry is a link to /#book-a-call. No element has
  // that id: the hash is the request, and openFromHash() below opens the panel
  // for it — on arrival from another page, on hashchange when already on the
  // homepage, and on a click that changes nothing because the hash is set.
  const CALL_HASH = '#book-a-call';

  function closePanel() {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
    // Otherwise a reload, or coming back with the back button, reopens it.
    if (window.location.hash === CALL_HASH) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  trigger.addEventListener('click', () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });
  closeBtn.addEventListener('click', closePanel);

  function openFromHash() {
    if (window.location.hash === CALL_HASH && panel.hidden) openPanel();
  }
  window.addEventListener('hashchange', openFromHash);
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    let target;
    try {
      target = new URL(link.href, window.location.href);
    } catch (err) {
      void err;
      return;
    }
    if (target.hash !== CALL_HASH || target.pathname !== window.location.pathname) return;
    openFromHash();
  });
  openFromHash();

  daysEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.call-slot');
    if (!btn) return;
    const start = btn.dataset.start;
    const slot = days.flatMap((d) => d.slots).find((s) => s.start === start);
    if (!slot) return;
    selectedSlot = slot;
    daysEl.querySelectorAll('.call-slot').forEach((b) => {
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    showErr('err-cb-submit', false);
    renderSelected();
  });

  // ── Submit ──────────────────────────────────────────────────────────────

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = val('cb-first-name');
    const lastName = val('cb-last-name');
    const email = val('cb-email');
    const consent = document.getElementById('cb-consent').checked;

    markInvalid('cb-first-name', 'err-cb-first-name', !firstName);
    markInvalid('cb-last-name', 'err-cb-last-name', !lastName);
    markInvalid('cb-email', 'err-cb-email', !emailValid(email));
    showErr('err-cb-consent', !consent);

    if (!selectedSlot) {
      document.getElementById('err-cb-submit').textContent = t('callChooseSlot');
      showErr('err-cb-submit', true);
      return;
    }
    if (!firstName || !lastName || !emailValid(email) || !consent) {
      const first = [...panel.querySelectorAll('.error')].find((el) =>
        el.classList.contains('is-visible-block')
      );
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    showErr('err-cb-submit', false);
    submitBtn.disabled = true;
    submitBtn.dataset.loading = '';
    submitBtn.textContent = t('callSubmitting');

    try {
      const res = await fetch('/api/book-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: selectedSlot.start,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: val('cb-phone') || null,
          topic: val('cb-topic') || null,
          language: lang(),
          consent: true,
          website: val('cb-website'),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // Somebody else took it, or the calendar changed underneath us.
        document.getElementById('err-cb-submit').textContent = data.error || t('callTaken');
        showErr('err-cb-submit', true);
        selectedSlot = null;
        renderSelected();
        await loadSlots();
        return;
      }
      if (!res.ok) {
        document.getElementById('err-cb-submit').textContent = data.error || t('callServerError');
        showErr('err-cb-submit', true);
        return;
      }

      success = {
        when: formatDay(data.start) + ', ' + (selectedSlot?.time || ''),
        meetLink: data.meet_link || null,
      };
      form.hidden = true;
      daysEl.hidden = true;
      statusKey = null;
      renderStatus();
      renderSuccess();
      successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      document.getElementById('err-cb-submit').textContent = t('callServerError');
      showErr('err-cb-submit', true);
    } finally {
      submitBtn.disabled = false;
      delete submitBtn.dataset.loading;
      submitBtn.textContent = t('callSubmit');
    }
  });

  document.addEventListener('lwg:language-applied', renderAll);
  renderAgbConsent();
})();
