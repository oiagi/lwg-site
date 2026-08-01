/* ── Reviews tab: moderate public reviews ─────────────────────────── */
import { apiFetch } from '../core/api.js';
import { esc, fmtDate } from '../core/helpers.js';

let reviews = null;
let currentFilter = 'all';

export async function loadReviews(force = true) {
  const list = document.getElementById('reviews-list');
  if (!list) return;
  if (force || !reviews) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
    try {
      const res = await apiFetch('/api/admin-reviews');
      if (!res.ok) throw new Error();
      reviews = await res.json();
    } catch {
      list.innerHTML =
        '<div class="loading-state">Could not load reviews. Has the reviews migration been run?</div>';
      return;
    }
  }
  renderReviews();
}

export function filterReviews(filter, el) {
  currentFilter = filter;
  document
    .querySelectorAll('.reviews-filter .filter-btn')
    .forEach((btn) => btn.classList.toggle('active', btn === el));
  renderReviews();
}

function visibleReviews() {
  if (currentFilter === 'pending') return reviews.filter((r) => !r.approved);
  if (currentFilter === 'live') return reviews.filter((r) => r.approved);
  return reviews;
}

function renderReviews() {
  const list = document.getElementById('reviews-list');
  if (!list || !reviews) return;
  const rows = visibleReviews();
  if (!rows.length) {
    list.innerHTML = '<div class="empty-state">no reviews here</div>';
    return;
  }
  list.innerHTML = rows
    .map((r) => {
      const otherLang = r.language === 'de' ? 'en' : 'de';
      return `
      <div class="review-admin-card${r.approved ? ' approved' : ''}" id="review-admin-${esc(r.id)}">
        <div class="review-admin-head">
          <span class="review-admin-status ${r.approved ? 'live' : 'pending'}">${r.approved ? 'live' : 'pending'}</span>
          <span class="review-admin-meta">submitted ${fmtDate(r.created_at)} · written in ${esc(r.language)}</span>
        </div>
        <div class="modal-field modal-field--compact">
          <label for="review-name-${esc(r.id)}">display name</label>
          <input type="text" id="review-name-${esc(r.id)}" maxlength="200" value="${esc(r.name)}" />
        </div>
        <div class="modal-field modal-field--compact">
          <label for="review-text-${esc(r.id)}">original (${esc(r.language)})</label>
          <textarea id="review-text-${esc(r.id)}" rows="4" maxlength="3000">${esc(r.text)}</textarea>
        </div>
        <div class="modal-field modal-field--compact">
          <label for="review-translation-${esc(r.id)}">translation (${otherLang})</label>
          <textarea id="review-translation-${esc(r.id)}" rows="4" maxlength="3000" placeholder="add the ${otherLang} version before approving">${esc(r.translation || '')}</textarea>
        </div>
        <div class="review-admin-actions">
          <button class="action-btn" data-action="saveReview" data-args="${esc(r.id)}">save</button>
          <button class="action-btn" data-action="toggleReviewApproval" data-args="${esc(r.id)}">
            ${r.approved ? 'take offline' : 'approve & publish'}
          </button>
          <button class="delete-btn" data-action="deleteReview" data-args="${esc(r.id)}">delete</button>
          <span class="review-admin-msg" id="review-msg-${esc(r.id)}"></span>
        </div>
      </div>`;
    })
    .join('');
}

function showRowMessage(id, text, isError = false) {
  const el = document.getElementById(`review-msg-${id}`);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error-text', isError);
  setTimeout(() => {
    if (el.textContent === text) el.textContent = '';
  }, 2500);
}

function readEdits(id) {
  return {
    name: document.getElementById(`review-name-${id}`).value.trim(),
    text: document.getElementById(`review-text-${id}`).value.trim(),
    translation: document.getElementById(`review-translation-${id}`).value.trim(),
  };
}

async function patchReview(id, patch) {
  const res = await apiFetch('/api/admin-reviews', { method: 'PATCH', body: { id, ...patch } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not update review');
  }
  const updated = await res.json();
  reviews = reviews.map((r) => (r.id === id ? updated : r));
  return updated;
}

export async function saveReview(id) {
  const edits = readEdits(id);
  if (!edits.name || !edits.text) {
    showRowMessage(id, 'Name and original text are required.', true);
    return;
  }
  try {
    await patchReview(id, edits);
    renderReviews();
    showRowMessage(id, 'saved');
  } catch (err) {
    showRowMessage(id, err.message, true);
  }
}

export async function toggleReviewApproval(id) {
  const review = reviews.find((r) => r.id === id);
  if (!review) return;
  const edits = readEdits(id);
  if (!edits.name || !edits.text) {
    showRowMessage(id, 'Name and original text are required.', true);
    return;
  }
  if (
    !review.approved &&
    !edits.translation &&
    !confirm(
      'No translation yet — the original text will be shown in both languages. Publish anyway?'
    )
  ) {
    return;
  }
  try {
    await patchReview(id, { ...edits, approved: !review.approved });
    renderReviews();
    showRowMessage(id, review.approved ? 'taken offline' : 'published');
  } catch (err) {
    showRowMessage(id, err.message, true);
  }
}

export async function deleteReview(id) {
  if (!confirm('Delete this review permanently?')) return;
  try {
    const res = await apiFetch('/api/admin-reviews', { method: 'DELETE', body: { id } });
    if (!res.ok) throw new Error();
    reviews = reviews.filter((r) => r.id !== id);
    renderReviews();
  } catch {
    showRowMessage(id, 'Could not delete review.', true);
  }
}
