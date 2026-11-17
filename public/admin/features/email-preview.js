/* ── Email preview ────────────────────────────────────────────────────
   Shows the exact email a send button is about to send. Every send endpoint
   answers `preview: true` with the subject and HTML built by the same code as
   the real send, without sending or storing anything.

   The emails style themselves with inline `style` attributes, which the
   site's Content-Security-Policy (style-src 'self') refuses, in an iframe as
   much as in the page. So the HTML is parsed off-document, its style
   attributes are lifted out and re-applied through the CSSOM (which the
   policy allows), and the result is mounted in a shadow root so the admin's
   own stylesheet cannot reach it.                                        */
import { apiFetch } from '../core/api.js';

/** POSTs `body` with `preview: true` and returns { to, subject, html, attachment, note }. */
export async function fetchEmailPreview(endpoint, body) {
  const res = await apiFetch(endpoint, { method: 'POST', body: { ...body, preview: true } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (!data.preview || typeof data.html !== 'string') {
    throw new Error('The server did not return a preview.');
  }
  return data;
}

const STYLE_HOLD = 'data-email-style';

function mountEmailHtml(host, html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc
    .querySelectorAll('script, style, link, meta, title, base, iframe, object, embed, form')
    .forEach((node) => node.remove());
  doc.querySelectorAll('[style]').forEach((el) => {
    el.setAttribute(STYLE_HOLD, el.getAttribute('style'));
    el.removeAttribute('style');
  });

  // The email's <body> becomes a plain block that starts from browser
  // defaults, like a mail client would, instead of inheriting admin styles.
  const page = document.createElement('div');
  const bodyStyle = doc.body.getAttribute(STYLE_HOLD) || '';
  page.style.cssText = `all:initial;display:block;${bodyStyle}`;
  for (const node of Array.from(doc.body.childNodes)) {
    page.appendChild(document.importNode(node, true));
  }
  page.querySelectorAll(`[${STYLE_HOLD}]`).forEach((el) => {
    el.style.cssText = el.getAttribute(STYLE_HOLD);
    el.removeAttribute(STYLE_HOLD);
  });
  // Links stay visible (hover shows the target) but do nothing in a preview.
  page.querySelectorAll('a[href]').forEach((a) => {
    a.title = a.getAttribute('href');
    a.tabIndex = -1;
  });
  page.addEventListener('click', (event) => {
    if (event.target.closest?.('a')) event.preventDefault();
  });

  host.attachShadow({ mode: 'open' }).appendChild(page);
}

function metaRow(label, value) {
  const row = document.createElement('p');
  row.className = 'email-preview-meta-row';
  const key = document.createElement('span');
  key.className = 'email-preview-meta-label';
  key.textContent = label;
  const text = document.createElement('span');
  text.textContent = value;
  row.append(key, text);
  return row;
}

/** One email: To / Subject / Attachment lines, an optional note, then the rendered email. */
export function emailPreviewCard(preview) {
  const card = document.createElement('div');
  card.className = 'email-preview';

  const meta = document.createElement('div');
  meta.className = 'email-preview-meta';
  if (preview.to) meta.appendChild(metaRow('To', preview.to));
  meta.appendChild(metaRow('Subject', preview.subject || ''));
  if (preview.attachment) meta.appendChild(metaRow('Attachment', preview.attachment));
  card.appendChild(meta);

  if (preview.note) {
    const note = document.createElement('p');
    note.className = 'email-preview-note';
    note.textContent = preview.note;
    card.appendChild(note);
  }

  const frame = document.createElement('div');
  frame.className = 'email-preview-frame';
  const host = document.createElement('div');
  mountEmailHtml(host, preview.html);
  frame.appendChild(host);
  card.appendChild(frame);
  return card;
}

function statusLine(text, isError = false) {
  const p = document.createElement('p');
  p.className = isError ? 'email-preview-status err' : 'email-preview-status';
  p.textContent = text;
  return p;
}

// One request generation per container, so a slow answer never overwrites a
// newer one.
const generations = new WeakMap();

/**
 * Loads and shows one or more email previews in `container`.
 * `load` returns a preview, or an array of them (a student who gets two
 * emails). Resolves true when the preview is showing, false on error or when a
 * newer call has taken over.
 */
export async function showEmailPreviews(container, load, { emptyText = '' } = {}) {
  if (!container) return false;
  const generation = (generations.get(container) || 0) + 1;
  generations.set(container, generation);
  container.replaceChildren(statusLine('loading preview…'));
  try {
    const result = await load();
    if (generations.get(container) !== generation) return false;
    const previews = (Array.isArray(result) ? result : [result]).filter(Boolean);
    if (!previews.length) {
      container.replaceChildren(statusLine(emptyText || 'Nothing to preview.'));
      return true;
    }
    container.replaceChildren(...previews.map(emailPreviewCard));
    return true;
  } catch (err) {
    if (generations.get(container) !== generation) return false;
    container.replaceChildren(statusLine(`Preview not available: ${err.message || err}`, true));
    return false;
  }
}

/** Empties a preview container and cancels whatever is still loading into it. */
export function clearEmailPreviews(container, text = '') {
  if (!container) return;
  generations.set(container, (generations.get(container) || 0) + 1);
  container.replaceChildren(...(text ? [statusLine(text)] : []));
}
