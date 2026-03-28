/* ── Admin entry point ────────────────────────────────────────────── */
import { TABS } from './constants.js';
import { initAuth, signIn, signOut, getSession } from './auth.js';
import { loadEnquiries, init as initEnquiries, toggleDetail, saveStatus, saveNotes, deleteEnquiry, confirmBooking } from './enquiries.js';
import { loadCourses, getCurrentCourseFilter, filterCourses, toggleCourse, syncCalendar, cancelSession, saveStudent, logSession, openNewCourseModal, closeNewCourseModal, addParticipantBlock, removeParticipantBlock, submitNewCourse, deleteCourse, openAttendanceModal, closeAttendanceModal, submitAttendance } from './courses.js';
import { loadCompanies, getCurrentCompanyFilter, filterCompanies, toggleCompany, openCompanyModal, closeCompanyModal, editCompany, submitCompany } from './companies.js';
import { loadStudents, getCurrentStudentFilter, filterStudents, toggleStudent, openStudentModal, closeStudentModal, editStudent, submitStudent, copyIntakeLink } from './students.js';
import { loadInvoices, getCurrentInvoiceFilter, filterInvoices, openInvoiceDetail, closeInvoiceDetailModal, updateInvoiceStatus, downloadInvoicePdf, openCreateInvoiceModal, closeCreateInvoiceModal, toggleAllInvSessions, updateInvTotalPreview, submitCreateInvoice, switchInvoiceMode, initVatListener } from './billing.js';
import { authoriseTeacher } from './teachers.js';
import { loadReport, getCurrentReportType, filterReport } from './reports.js';
import { loadAvailability, onTeacherSelect } from './availability.js';
import { trapFocus, releaseFocus } from './helpers.js';

/* ── Action registry for event delegation ─────────────────────────── */
const actions = {
  // Enquiries
  toggleDetail, saveStatus, saveNotes, deleteEnquiry, confirmBooking,
  // Courses
  filterCourses, toggleCourse, syncCalendar, cancelSession, saveStudent, logSession,
  openNewCourseModal, closeNewCourseModal, addParticipantBlock, removeParticipantBlock, submitNewCourse, deleteCourse,
  openAttendanceModal, closeAttendanceModal, submitAttendance,
  // Students
  filterStudents, toggleStudent, openStudentModal, closeStudentModal, editStudent, submitStudent, copyIntakeLink,
  // Companies
  filterCompanies, toggleCompany, openCompanyModal, closeCompanyModal, editCompany, submitCompany,
  // Billing
  filterInvoices, openInvoiceDetail, closeInvoiceDetailModal, updateInvoiceStatus,
  downloadInvoicePdf, openCreateInvoiceModal, closeCreateInvoiceModal,
  toggleAllInvSessions, updateInvTotalPreview, submitCreateInvoice, switchInvoiceMode,
  // Teachers
  authoriseTeacher,
  // Reports
  filterReport,
  // Availability
  onTeacherSelect,
  // Tab switching
  switchTab,
};

/* ── Event delegation: handles all data-action clicks ─────────────── */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const name = el.dataset.action;
  const fn = actions[name];
  if (!fn) return;
  const args = el.dataset.args ? el.dataset.args.split(',') : [];
  e.stopPropagation();
  fn(...args, el);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-action-change]');
  if (!el) return;
  const name = el.dataset.actionChange;
  const fn = actions[name];
  if (!fn) return;
  const args = el.dataset.args ? el.dataset.args.split(',') : [];
  fn(...args);
});

/* ── Tab switching ───────────────────────────────────────────────── */
function switchTab(tab) {
  const tabs = TABS;
  for (const t of tabs) {
    document.getElementById('panel-' + t).style.display = tab === t ? 'block' : 'none';
    document.getElementById('tab-' + t).classList.toggle('active', tab === t);
  }
  if (tab === 'courses') loadCourses(getCurrentCourseFilter());
  if (tab === 'students') loadStudents(getCurrentStudentFilter());
  if (tab === 'companies') loadCompanies(getCurrentCompanyFilter());
  if (tab === 'billing') loadInvoices(getCurrentInvoiceFilter());
  if (tab === 'reports') loadReport(getCurrentReportType());
  if (tab === 'teachers') loadAvailability();
}

/* ── Show dashboard ──────────────────────────────────────────────── */
function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display    = 'block';
  loadEnquiries('all');
}

/* ── Login ───────────────────────────────────────────────────────── */
document.getElementById('admin-pwd').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('admin-email').value.trim();
  const pwd   = document.getElementById('admin-pwd').value;
  if (!email || !pwd) return;

  try {
    await signIn(email, pwd);
    document.getElementById('pwd-error').style.display = 'none';
    showDashboard();
  } catch {
    document.getElementById('pwd-error').style.display = 'block';
  }
});

/* ── Logout ──────────────────────────────────────────────────────── */
document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  document.getElementById('dashboard').style.display    = 'none';
  document.getElementById('login-screen').style.display = 'block';
  document.getElementById('admin-email').value = '';
  document.getElementById('admin-pwd').value   = '';
});

/* ── Init ────────────────────────────────────────────────────────── */
initEnquiries();
initVatListener();

/* ── Bootstrap: init Supabase, check existing session ────────────── */
(async function() {
  try {
    await initAuth();
    const session = await getSession();
    if (session) {
      showDashboard();
    }
  } catch (err) {
    console.error('Auth init failed:', err);
  }
})();

/* ── Handle auth success redirect ────────────────────────────────── */
(function() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('auth') === 'success') {
    history.replaceState({}, '', '/admin.html');
  }
})();

/* ── Escape key closes topmost modal; focus trap on open modals ──── */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const openModals = document.querySelectorAll('.modal-overlay.open');
  if (!openModals.length) return;
  const topModal = openModals[openModals.length - 1];
  topModal.classList.remove('open');
  releaseFocus();
});

// Observe modal-overlay elements for open/close class changes
const modalObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
    const el = m.target;
    if (!el.classList.contains('modal-overlay')) continue;
    if (el.classList.contains('open')) {
      const modal = el.querySelector('.modal');
      if (modal) trapFocus(modal);
    } else {
      releaseFocus();
    }
  }
});
for (const overlay of document.querySelectorAll('.modal-overlay')) {
  modalObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
}
