/* ── Feedback: anonymous course feedback responses ─────────────────────
   Two surfaces over the same endpoint: the feedback tab (all courses)
   and the on-demand responses list inside a course detail. Responses
   carry no student reference; the only per-student fact the admin ever
   sees is that a request went out. Question labels always come from the
   API so they cannot drift from _feedback.js.                          */
import { apiFetch } from '../core/api.js';
import { esc, fmtDate } from '../core/helpers.js';

let feedback = null;
let currentFilter = 'all';

const MIGRATION_HINT = 'Has the add_course_feedback_responses migration been run?';

export const KIND_LABELS = { midterm: 'mid-course', final: 'end of course' };

export function kindLabel(kind) {
  return KIND_LABELS[kind] || kind || '—';
}

function responseCard(row, questionsByKind, options = {}) {
  const questions = questionsByKind?.[row.kind] || {};
  const answers = row.answers || {};
  const heading = options.hideCourse
    ? esc(kindLabel(row.kind))
    : `${esc(row.course_code || '—')} · ${esc(kindLabel(row.kind))}`;

  const ratings = (questions.ratings || [])
    .map((q) => {
      const value = answers[q.id];
      if (value === null || value === undefined) return '';
      return `<li>${esc(q.label)} · <span class="detail-muted">${esc(String(value))}/${q.max || 5}</span></li>`;
    })
    .filter(Boolean)
    .join('');

  // Choices are stored as machine values ('a_lot'); the labels ride along
  // with the response so this stays in step with _feedback.js.
  const choices = (questions.choices || [])
    .map((q) => {
      const stored = answers[q.id];
      if (stored === null || stored === undefined || (Array.isArray(stored) && !stored.length)) {
        return '';
      }
      const labels = (Array.isArray(stored) ? stored : [stored])
        .map((v) => (q.options || []).find((o) => o.value === v)?.label || v)
        .join(', ');
      const other = q.otherKey && answers[q.otherKey] ? ` (${answers[q.otherKey]})` : '';
      return `<li>${esc(q.label)} · <span class="detail-muted">${esc(labels + other)}</span></li>`;
    })
    .filter(Boolean)
    .join('');

  const comments = (questions.comments || [])
    .map((q) => {
      const text = answers[q.id];
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
    <div class="feedback-card feedback-card--${esc(row.kind)}">
      <div class="feedback-card-head">
        <span class="feedback-card-title">${heading}</span>
        <span class="feedback-card-meta">${esc(fmtDate(row.submitted_on))}</span>
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
    const rows = data.responses || [];
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
  if (currentFilter === 'midterm' || currentFilter === 'final') {
    return rows.filter((r) => r.kind === currentFilter);
  }
  return rows;
}

/** "mid-course 4 of 6 responded · end of course 3 of 6 responded · NPS 50" */
function summaryText(summary) {
  const parts = [];
  for (const kind of ['midterm', 'final']) {
    const s = summary?.[kind];
    if (!s?.requested && !s?.submitted) continue;
    parts.push(`${kindLabel(kind)} ${s.submitted} of ${s.requested} responded`);
  }
  const nps = summary?.final?.nps;
  if (nps?.score !== null && nps?.score !== undefined) parts.push(`NPS ${nps.score}`);
  return parts.join(' · ');
}

function summaryLine() {
  const text = summaryText(feedback?.summary);
  if (!text) return '';
  const averages = (feedback?.summary?.final?.averages || [])
    .filter((a) => a.value !== null && a.value !== undefined)
    .map((a) => `${esc(a.label)} ${esc(String(a.value))}/10`)
    .join(' · ');
  return `
    <p class="feedback-summary">
      ${esc(text)}
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
