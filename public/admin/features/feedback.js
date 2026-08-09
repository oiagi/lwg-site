/* ── Feedback: course feedback responses ──────────────────────────────
   Two surfaces over the same endpoint: the feedback tab (all courses)
   and the on-demand responses list inside a course detail. Question
   labels always come from the API so they cannot drift from the
   columns in _feedback.js.                                            */
import { apiFetch } from '../core/api.js';
import { esc, fmtDate } from '../core/helpers.js';

let feedback = null;
let currentFilter = 'submitted';

const MIGRATION_HINT = 'Has the add_course_feedback migration been run?';

function responseCard(row, questions, options = {}) {
  const heading = options.hideCourse
    ? esc(row.student_name || row.student_email || '—')
    : `${esc(row.course_code || '—')} · ${esc(row.student_name || row.student_email || '—')}`;

  if (!row.submitted_at) {
    return `
      <div class="feedback-card feedback-card--pending">
        <div class="feedback-card-head">
          <span class="feedback-card-title">${heading}</span>
          <span class="feedback-card-meta">requested ${esc(fmtDate(row.requested_at))} · no response yet</span>
        </div>
      </div>`;
  }

  const ratings = (questions?.ratings || [])
    .map((q) => {
      const value = row[q.column];
      if (value === null || value === undefined) return '';
      return `<li>${esc(q.label)} · <span class="detail-muted">${esc(String(value))}/${q.max || 5}</span></li>`;
    })
    .filter(Boolean)
    .join('');

  // Choices are stored as machine values ('a_lot'); the labels ride along
  // with the response so this stays in step with _feedback.js.
  const choices = (questions?.choices || [])
    .map((q) => {
      const stored = row[q.column];
      if (stored === null || stored === undefined || (Array.isArray(stored) && !stored.length)) {
        return '';
      }
      const labels = (Array.isArray(stored) ? stored : [stored])
        .map((v) => (q.options || []).find((o) => o.value === v)?.label || v)
        .join(', ');
      const other = q.otherColumn && row[q.otherColumn] ? ` (${row[q.otherColumn]})` : '';
      return `<li>${esc(q.label)} · <span class="detail-muted">${esc(labels + other)}</span></li>`;
    })
    .filter(Boolean)
    .join('');

  const comments = (questions?.comments || [])
    .map((q) => {
      const text = row[q.column];
      if (!text) return '';
      return `
        <div class="feedback-comment">
          <p class="detail-muted feedback-comment-label">${esc(q.label)}</p>
          <p class="feedback-comment-text">${esc(text)}</p>
        </div>`;
    })
    .filter(Boolean)
    .join('');

  return `
    <div class="feedback-card">
      <div class="feedback-card-head">
        <span class="feedback-card-title">${heading}</span>
        <span class="feedback-card-meta">${esc(fmtDate(row.submitted_at))}</span>
      </div>
      <ul class="feedback-rating-list">${ratings}${choices}</ul>
      ${comments || '<p class="detail-muted">no written comments</p>'}
    </div>`;
}

/* ── Course detail: load the responses for one course on demand ────── */
export async function loadCourseFeedback(courseId, el) {
  const target = document.getElementById('course-feedback-' + courseId);
  if (!target) return;

  // Second click collapses the list again.
  if (target.dataset.loaded === 'true') {
    target.innerHTML = '';
    delete target.dataset.loaded;
    if (el) el.textContent = 'view responses';
    return;
  }

  target.innerHTML = '<div class="loading-state">loading…</div>';
  try {
    const res = await apiFetch('/api/get-feedback?course_id=' + encodeURIComponent(courseId));
    if (!res.ok) throw new Error();
    const data = await res.json();
    const rows = (data.responses || []).filter((r) => r.submitted_at);
    target.innerHTML = rows.length
      ? rows.map((r) => responseCard(r, data.questions, { hideCourse: true })).join('')
      : '<p class="detail-muted">no responses yet</p>';
    target.dataset.loaded = 'true';
    if (el) el.textContent = 'hide responses';
  } catch {
    target.innerHTML = `<p class="detail-muted">Could not load feedback. ${MIGRATION_HINT}</p>`;
  }
}

/* ── Feedback tab: every response across all courses ───────────────── */
export async function loadFeedback(force = true) {
  const list = document.getElementById('feedback-list');
  if (!list) return;
  if (force || !feedback) {
    list.innerHTML = '<div class="loading-state">loading…</div>';
    try {
      const res = await apiFetch('/api/get-feedback');
      if (!res.ok) throw new Error();
      feedback = await res.json();
    } catch {
      list.innerHTML = `<div class="loading-state">Could not load feedback. ${MIGRATION_HINT}</div>`;
      return;
    }
  }
  renderFeedback();
}

export function filterFeedback(filter, el) {
  currentFilter = filter;
  document
    .querySelectorAll('.feedback-filter .filter-btn')
    .forEach((btn) => btn.classList.toggle('active', btn === el));
  renderFeedback();
}

function visibleFeedback() {
  const rows = feedback?.responses || [];
  if (currentFilter === 'submitted') return rows.filter((r) => r.submitted_at);
  if (currentFilter === 'awaiting') return rows.filter((r) => !r.submitted_at);
  return rows;
}

function summaryLine() {
  const summary = feedback?.summary;
  if (!summary?.requested) return '';
  const averages = (summary.averages || [])
    .filter((a) => a.value !== null && a.value !== undefined)
    .map((a) => `${esc(a.label)} ${esc(String(a.value))}/5`)
    .join(' · ');
  const nps =
    summary.nps?.score !== null && summary.nps?.score !== undefined
      ? ` · NPS ${esc(String(summary.nps.score))}`
      : '';
  return `
    <p class="feedback-summary">
      ${summary.submitted} of ${summary.requested} requests answered${nps}
      ${averages ? `<span class="detail-muted"> — ${averages}</span>` : ''}
    </p>`;
}

function renderFeedback() {
  const list = document.getElementById('feedback-list');
  if (!list || !feedback) return;
  const rows = visibleFeedback();
  if (!rows.length) {
    list.innerHTML = summaryLine() + '<div class="empty-state">no feedback here</div>';
    return;
  }
  list.innerHTML = summaryLine() + rows.map((r) => responseCard(r, feedback.questions)).join('');
}
