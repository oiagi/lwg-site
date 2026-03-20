/* ── Reports tab ─────────────────────────────────────────────────────── */
import { apiFetch } from './api.js';

let currentReportType = 'overview';

export function getCurrentReportType() { return currentReportType; }

export function filterReport(type) {
  currentReportType = type;
  document.querySelectorAll('[data-report-type]').forEach(b => {
    b.classList.toggle('active', b.dataset.reportType === type);
  });
  loadReport(type);
}

export async function loadReport(type = 'overview') {
  const container = document.getElementById('report-content');
  container.innerHTML = '<div class="loading-state">loading…</div>';

  try {
    const res = await apiFetch('/api/get-report?type=' + type);
    if (!res.ok) throw new Error();
    const data = await res.json();

    switch (type) {
      case 'overview':   renderOverview(data, container); break;
      case 'revenue':    renderRevenue(data, container); break;
      case 'sessions':   renderSessions(data, container); break;
      case 'attendance': renderAttendance(data, container); break;
    }
  } catch {
    container.innerHTML = '<div class="loading-state">Could not load report.</div>';
  }
}

/* ── Overview ──────────────────────────────────────────────────────── */
function renderOverview(data, el) {
  el.innerHTML = `
    <div class="report-grid">
      <div class="report-card">
        <span class="report-card-value">${data.active_courses}</span>
        <span class="report-card-label">active courses</span>
      </div>
      <div class="report-card">
        <span class="report-card-value">${data.total_students}</span>
        <span class="report-card-label">students</span>
      </div>
      <div class="report-card">
        <span class="report-card-value">${data.upcoming_sessions_30d}</span>
        <span class="report-card-label">sessions next 30 days</span>
      </div>
      <div class="report-card">
        <span class="report-card-value">${data.currency} ${data.outstanding_amount.toFixed(2)}</span>
        <span class="report-card-label">outstanding</span>
      </div>
      <div class="report-card">
        <span class="report-card-value">${data.currency} ${data.total_paid.toFixed(2)}</span>
        <span class="report-card-label">total paid</span>
      </div>
    </div>
  `;
}

/* ── Revenue ───────────────────────────────────────────────────────── */
function renderRevenue(data, el) {
  if (!data.rows || !data.rows.length) {
    el.innerHTML = '<div class="empty-state">no invoice data</div>';
    return;
  }

  const totals = data.rows.reduce((acc, r) => {
    acc.invoiced += r.invoiced;
    acc.paid += r.paid;
    acc.outstanding += r.outstanding;
    acc.count += r.count;
    return acc;
  }, { invoiced: 0, paid: 0, outstanding: 0, count: 0 });

  el.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>month</th>
          <th class="num">invoices</th>
          <th class="num">invoiced</th>
          <th class="num">paid</th>
          <th class="num">outstanding</th>
        </tr>
      </thead>
      <tbody>
        ${data.rows.map(r => `
          <tr>
            <td>${formatMonth(r.month)}</td>
            <td class="num">${r.count}</td>
            <td class="num">${data.currency} ${r.invoiced.toFixed(2)}</td>
            <td class="num paid">${data.currency} ${r.paid.toFixed(2)}</td>
            <td class="num outstanding">${r.outstanding > 0 ? data.currency + ' ' + r.outstanding.toFixed(2) : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td>total</td>
          <td class="num">${totals.count}</td>
          <td class="num">${data.currency} ${totals.invoiced.toFixed(2)}</td>
          <td class="num paid">${data.currency} ${totals.paid.toFixed(2)}</td>
          <td class="num outstanding">${totals.outstanding > 0 ? data.currency + ' ' + totals.outstanding.toFixed(2) : '—'}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

/* ── Sessions ──────────────────────────────────────────────────────── */
function renderSessions(data, el) {
  if (!data.length) {
    el.innerHTML = '<div class="empty-state">no session data</div>';
    return;
  }

  const totals = data.reduce((acc, r) => {
    acc.completed += r.completed;
    acc.scheduled += r.scheduled;
    acc.cancelled += r.cancelled;
    acc.total += r.total;
    return acc;
  }, { completed: 0, scheduled: 0, cancelled: 0, total: 0 });

  el.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>month</th>
          <th class="num">completed</th>
          <th class="num">scheduled</th>
          <th class="num">cancelled</th>
          <th class="num">total</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(r => `
          <tr>
            <td>${formatMonth(r.month)}</td>
            <td class="num completed">${r.completed}</td>
            <td class="num">${r.scheduled}</td>
            <td class="num cancelled">${r.cancelled || '—'}</td>
            <td class="num">${r.total}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td>total</td>
          <td class="num completed">${totals.completed}</td>
          <td class="num">${totals.scheduled}</td>
          <td class="num cancelled">${totals.cancelled || '—'}</td>
          <td class="num">${totals.total}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

/* ── Attendance ────────────────────────────────────────────────────── */
function renderAttendance(data, el) {
  if (!data.length) {
    el.innerHTML = '<div class="empty-state">no attendance data</div>';
    return;
  }

  el.innerHTML = `
    <table class="report-table">
      <thead>
        <tr>
          <th>course</th>
          <th>status</th>
          <th class="num">present</th>
          <th class="num">absent</th>
          <th class="num">rate</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(r => `
          <tr>
            <td>${r.course_code}</td>
            <td><span class="course-status ${r.status}">${r.status}</span></td>
            <td class="num">${r.present}</td>
            <td class="num">${r.absent}</td>
            <td class="num ${attendanceClass(r.rate)}">${r.rate !== null ? r.rate + '%' : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function formatMonth(m) {
  if (!m || m === 'unknown') return '—';
  const [y, mo] = m.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(mo, 10) - 1] + ' ' + y;
}

function attendanceClass(rate) {
  if (rate === null) return '';
  if (rate >= 90) return 'att-high';
  if (rate >= 70) return 'att-mid';
  return 'att-low';
}
