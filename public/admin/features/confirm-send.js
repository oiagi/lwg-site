/* ── Confirm-send modal: preview recipients + content before sending ── */
import { esc } from '../core/helpers.js';

let pendingHandler = null;
let currentRecipients = [];
let recipientsSelectable = false;

export function openConfirmSend({
  title,
  recipients,
  subject,
  contentHtml,
  languageOptions,
  defaultLanguage,
  selectableRecipients = false,
  onConfirm,
}) {
  const modal = document.getElementById('confirm-send-modal');
  const titleEl = document.getElementById('cs-title');
  const subjectEl = document.getElementById('cs-subject');
  const contentEl = document.getElementById('cs-content');
  const languageField = document.getElementById('cs-language-field');
  const languageInputs = document.querySelectorAll('input[name="cs-language"]');
  const msg = document.getElementById('cs-msg');
  const btn = document.getElementById('cs-submit');

  titleEl.textContent = title || 'confirm send';

  recipientsSelectable = Boolean(selectableRecipients);
  currentRecipients = (recipients || []).map((r) => ({
    ...r,
    selected: r.selected !== false,
  }));
  renderRecipients();

  subjectEl.textContent = subject || '';
  contentEl.innerHTML = contentHtml || '';
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
  msg.style.display = 'none';

  btn.disabled = selectedRecipients().length === 0;
  btn.textContent = 'send';

  pendingHandler = onConfirm;
  modal.classList.add('open');
}

export function closeConfirmSend() {
  document.getElementById('confirm-send-modal').classList.remove('open');
  pendingHandler = null;
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
    const language = document.querySelector('input[name="cs-language"]:checked')?.value || 'de';
    await handler({ language, recipients: selectedRecipients() });
    closeConfirmSend();
  } catch (err) {
    msg.textContent = 'Error: ' + (err.message || err);
    msg.className = 'modal-msg err';
    msg.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'send';
  }
}

function selectedRecipients() {
  return currentRecipients.filter((r) => r.selected);
}

function renderRecipients() {
  const recipientsEl = document.getElementById('cs-recipients');
  const countEl = document.getElementById('cs-recipients-count');
  const btn = document.getElementById('cs-submit');
  const selected = selectedRecipients().length;

  countEl.textContent = currentRecipients.length
    ? recipientsSelectable
      ? `(${selected} selected)`
      : `(${currentRecipients.length})`
    : '';
  if (btn) btn.disabled = selected === 0;

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
}
