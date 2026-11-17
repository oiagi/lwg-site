/* ── Confirm-send modal: recipients + the email before sending ────────
   Two modes. With `loadPreview` it shows the exact email for one recipient
   (every send button of the course overview). Without it, it falls back to a
   subject line and a hand-written summary (`subject` + `contentHtml`), which
   the intake-link and company sends still use.                          */
import { esc } from '../core/helpers.js';
import { showEmailPreviews, clearEmailPreviews } from './email-preview.js';

let pendingHandler = null;
let previewLoader = null;
let currentRecipients = [];
let recipientsSelectable = false;
let previewIndex = -1;
let listenersBound = false;

/**
 * @param {object}   options
 * @param {Array}    options.recipients   - [{ name, email, selected?, … }]
 * @param {Function} [options.loadPreview] - ({ language, recipient }) =>
 *   Promise of the preview ({ to, subject, html, … }) for that one recipient
 * @param {string}   [options.subject]    - summary mode: the subject line
 * @param {string}   [options.contentHtml] - summary mode: trusted summary HTML
 * @param {string}   [options.hint]       - admin-only note shown under the
 *   preview (things the email itself does not say)
 * @param {Function} options.onConfirm    - ({ language, recipients }) => Promise
 */
export function openConfirmSend({
  title,
  recipients,
  loadPreview,
  subject,
  contentHtml,
  hint = '',
  languageOptions,
  defaultLanguage,
  selectableRecipients = false,
  onConfirm,
}) {
  const modal = document.getElementById('confirm-send-modal');
  const languageField = document.getElementById('cs-language-field');
  const languageInputs = document.querySelectorAll('input[name="cs-language"]');
  const msg = document.getElementById('cs-msg');
  const btn = document.getElementById('cs-submit');

  document.getElementById('cs-title').textContent = title || 'confirm send';
  document.getElementById('cs-hint').textContent = hint;

  recipientsSelectable = Boolean(selectableRecipients);
  currentRecipients = (recipients || []).map((r) => ({
    ...r,
    selected: r.selected !== false,
  }));
  previewLoader = loadPreview || null;
  previewIndex = -1;

  document.getElementById('cs-preview-field').hidden = !previewLoader;
  document.getElementById('cs-subject-field').hidden = Boolean(previewLoader);
  document.getElementById('cs-summary-field').hidden = Boolean(previewLoader);
  document.getElementById('cs-subject').textContent = previewLoader ? '' : subject || '';
  document.getElementById('cs-summary').innerHTML = previewLoader ? '' : contentHtml || '';
  btn.disabled = false;

  if (languageField) {
    const showLanguage = Array.isArray(languageOptions) && languageOptions.length > 0;
    languageField.hidden = !showLanguage;
    languageInputs.forEach((input) => {
      const option = languageOptions?.find((item) => item.value === input.value);
      input.closest('label').hidden = !option;
      input.checked = input.value === (defaultLanguage || 'de');
    });
  }

  msg.textContent = '';
  msg.className = 'modal-msg';
  msg.classList.remove('is-visible-block');
  btn.textContent = 'send';

  bindListeners();
  pendingHandler = onConfirm;
  renderRecipients();
  modal.classList.add('open');
}

export function closeConfirmSend() {
  document.getElementById('confirm-send-modal').classList.remove('open');
  clearEmailPreviews(document.getElementById('cs-content'));
  pendingHandler = null;
  previewLoader = null;
  currentRecipients = [];
  recipientsSelectable = false;
}

export async function submitConfirmSend() {
  if (!pendingHandler) return;
  const btn = document.getElementById('cs-submit');
  const msg = document.getElementById('cs-msg');
  const handler = pendingHandler;
  btn.disabled = true;
  btn.textContent = 'sending…';
  try {
    await handler({ language: currentLanguage(), recipients: selectedRecipients() });
    closeConfirmSend();
  } catch (err) {
    msg.textContent = 'Error: ' + (err.message || err);
    msg.className = 'modal-msg err';
    msg.classList.add('is-visible-block');
    btn.disabled = false;
    btn.textContent = 'send';
  }
}

function currentLanguage() {
  return document.querySelector('input[name="cs-language"]:checked')?.value || 'de';
}

function selectedRecipients() {
  return currentRecipients.filter((r) => r.selected);
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;
  document.querySelectorAll('input[name="cs-language"]').forEach((input) => {
    input.addEventListener('change', updatePreview);
  });
  document.getElementById('cs-preview-for').addEventListener('change', (event) => {
    previewIndex = parseInt(event.target.value, 10);
    updatePreview();
  });
}

/* The preview follows one ticked recipient. The picker lists the ticked ones;
   when the one on show is unticked, the preview moves to the first that is
   still ticked. */
function renderPreviewPicker() {
  const picker = document.getElementById('cs-preview-for');
  const wrap = document.getElementById('cs-preview-for-wrap');
  const ticked = currentRecipients.map((r, i) => ({ r, i })).filter(({ r }) => r.selected);
  if (!ticked.some(({ i }) => i === previewIndex)) previewIndex = ticked[0]?.i ?? -1;
  picker.innerHTML = ticked
    .map(
      ({ r, i }) =>
        `<option value="${i}"${i === previewIndex ? ' selected' : ''}>${esc(r.name || r.email)}</option>`
    )
    .join('');
  wrap.hidden = ticked.length < 2;
}

async function updatePreview() {
  const container = document.getElementById('cs-content');
  const btn = document.getElementById('cs-submit');
  const recipient = currentRecipients[previewIndex];
  if (!previewLoader) return;
  if (!recipient) {
    clearEmailPreviews(container, 'Select at least one recipient.');
    return;
  }
  const loader = previewLoader;
  // Nothing goes out unseen: send stays off until the preview is on screen.
  btn.disabled = true;
  const shown = await showEmailPreviews(container, () =>
    loader({ language: currentLanguage(), recipient })
  );
  if (shown && previewLoader === loader) btn.disabled = selectedRecipients().length === 0;
}

function renderRecipients() {
  const recipientsEl = document.getElementById('cs-recipients');
  const countEl = document.getElementById('cs-recipients-count');
  const btn = document.getElementById('cs-submit');
  const selected = selectedRecipients().length;
  const shownBefore = previewIndex;

  countEl.textContent = currentRecipients.length
    ? recipientsSelectable
      ? `(${selected} selected)`
      : `(${currentRecipients.length})`
    : '';
  if (btn && selected === 0) btn.disabled = true;

  recipientsEl.innerHTML = currentRecipients.length
    ? currentRecipients
        .map((r, i) => {
          const contents = `<span class="cs-recipient-name">${esc(r.name || '—')}</span> <span class="cs-recipient-email">&lt;${esc(r.email)}&gt;</span>`;
          return recipientsSelectable
            ? `<li><label class="cs-recipient-row"><input type="checkbox" data-cs-recipient="${i}" ${r.selected ? 'checked' : ''}>${contents}</label></li>`
            : `<li>${contents}</li>`;
        })
        .join('')
    : '<li class="cs-empty">No recipients with an email address.</li>';

  recipientsEl.querySelectorAll('input[data-cs-recipient]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const idx = parseInt(cb.dataset.csRecipient, 10);
      if (!currentRecipients[idx]) return;
      currentRecipients[idx].selected = cb.checked;
      renderRecipients();
    });
  });

  renderPreviewPicker();
  // Reload only when the recipient on show changed (or on first render);
  // otherwise just re-arm the send button a fresh tick may have enabled.
  if (previewIndex !== shownBefore || shownBefore === -1) updatePreview();
  else if (
    btn &&
    selected > 0 &&
    (!previewLoader || document.querySelector('#cs-content .email-preview'))
  ) {
    btn.disabled = false;
  }
}
