/* ══════════════════════════════════════════════════════════════════
   ENQUIRY FORM — single page
   Fields: lesson type (textarea), first/last name, email, phone,
           preferred contact method.
   Submits directly to /api/submit-enquiry; no sessionStorage relay.
══════════════════════════════════════════════════════════════════ */

const preferredContact = document.getElementById('preferred-contact');
const phoneLabel = document.getElementById('label-lead-phone');

/* ── Toggle phone optional when Email-only preferred ────────────── */
function updatePhoneLabel() {
  const emailOnly = preferredContact.value === 'Email';
  const key = emailOnly ? 'enquiryPhoneOptional' : 'enquiryPhone';
  phoneLabel.textContent =
    window.LWG_I18N?.translateRuntime(key) || (emailOnly ? 'phone (optional)' : 'phone');
}
preferredContact.addEventListener('change', updatePhoneLabel);
document.addEventListener('lwg:language-applied', updatePhoneLabel);

/* ── Submit ─────────────────────────────────────────────────────── */
document.getElementById('submit-btn').addEventListener('click', async () => {
  function showErr(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('is-visible-block', show);
  }

  let valid = true;

  const lessonType = document.getElementById('lesson-type').value.trim();
  showErr('err-lesson-type', !lessonType);
  if (!lessonType) valid = false;

  const leadFirst = document.getElementById('lead-first').value.trim();
  showErr('err-lead-first', !leadFirst);
  if (!leadFirst) valid = false;

  const leadLast = document.getElementById('lead-last').value.trim();
  showErr('err-lead-last', !leadLast);
  if (!leadLast) valid = false;

  const leadEmail = document.getElementById('lead-email').value.trim();
  showErr('err-lead-email', !leadEmail);
  if (!leadEmail) valid = false;

  const leadPhone = document.getElementById('lead-phone').value.trim();
  const phoneRequired = preferredContact.value !== 'Email';
  showErr('err-lead-phone', phoneRequired && !leadPhone);
  if (phoneRequired && !leadPhone) valid = false;

  const preferredContactVal = preferredContact.value;
  showErr('err-preferred-contact', !preferredContactVal);
  if (!preferredContactVal) valid = false;

  if (!valid) {
    const first = [...document.querySelectorAll('.error')].find((e) =>
      e.classList.contains('is-visible-block')
    );
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = first.closest('.field')?.querySelector('input, select, textarea');
      if (input) input.focus({ preventScroll: true });
    }
    return;
  }

  const booking = { lessonType };
  const contact = {
    lead: {
      firstName: leadFirst,
      lastName: leadLast,
      email: leadEmail,
      phone: leadPhone || null,
    },
    preferredContact: preferredContactVal,
  };

  const btn = document.getElementById('submit-btn');
  const originalText = btn.textContent;
  btn.dataset.loading = '';
  btn.disabled = true;
  btn.textContent = window.LWG_I18N?.translateRuntime('enquirySubmitting') || 'sending…';

  try {
    const res = await fetch('/api/submit-enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking,
        contact,
        language: window.LWG_I18N?.getLang() || document.documentElement.lang || 'en',
      }),
    });
    if (!res.ok) throw new Error('Server error');
    window.location.href = window.LWG_I18N
      ? window.LWG_I18N.href('/thankyou.html', window.LWG_I18N.getLang())
      : '/thankyou';
  } catch {
    delete btn.dataset.loading;
    btn.disabled = false;
    btn.textContent = originalText;
    document.getElementById('submit-error').classList.add('is-visible-block');
  }
});
