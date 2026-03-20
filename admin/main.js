/* ── Admin entry point ────────────────────────────────────────────── */
import { getPassword, setPassword } from './api.js';
import { loadEnquiries, init as initEnquiries, toggleDetail, saveStatus, saveNotes, deleteEnquiry, confirmBooking } from './enquiries.js';
import { loadCourses, getCurrentCourseFilter, filterCourses, toggleCourse, syncCalendar, cancelSession, saveStudent, logSession, openNewCourseModal, closeNewCourseModal, addParticipantBlock, submitNewCourse, deleteCourse, openAttendanceModal, closeAttendanceModal, submitAttendance } from './courses.js';
import { loadCompanies, getCurrentCompanyFilter, filterCompanies, toggleCompany, openCompanyModal, closeCompanyModal, editCompany, submitCompany } from './companies.js';
import { loadInvoices, getCurrentInvoiceFilter, filterInvoices, openInvoiceDetail, closeInvoiceDetailModal, updateInvoiceStatus, downloadInvoicePdf, openCreateInvoiceModal, closeCreateInvoiceModal, toggleAllInvSessions, updateInvTotalPreview, submitCreateInvoice, initVatListener } from './billing.js';
import { authoriseTeacher } from './teachers.js';

/* ── Register globals for onclick handlers in HTML templates ──────── */
Object.assign(window, {
  // Enquiries
  toggleDetail, saveStatus, saveNotes, deleteEnquiry, confirmBooking,
  // Courses
  filterCourses, toggleCourse, syncCalendar, cancelSession, saveStudent, logSession,
  openNewCourseModal, closeNewCourseModal, addParticipantBlock, submitNewCourse, deleteCourse,
  openAttendanceModal, closeAttendanceModal, submitAttendance,
  // Companies
  filterCompanies, toggleCompany, openCompanyModal, closeCompanyModal, editCompany, submitCompany,
  // Billing
  filterInvoices, openInvoiceDetail, closeInvoiceDetailModal, updateInvoiceStatus,
  downloadInvoicePdf, openCreateInvoiceModal, closeCreateInvoiceModal,
  toggleAllInvSessions, updateInvTotalPreview, submitCreateInvoice,
  // Teachers
  authoriseTeacher,
  // Tab switching
  switchTab,
});

/* ── Tab switching ───────────────────────────────────────────────── */
function switchTab(tab) {
  document.getElementById('panel-enquiries').style.display = tab === 'enquiries' ? 'block' : 'none';
  document.getElementById('panel-courses').style.display   = tab === 'courses'   ? 'block' : 'none';
  document.getElementById('panel-companies').style.display  = tab === 'companies' ? 'block' : 'none';
  document.getElementById('panel-billing').style.display    = tab === 'billing'   ? 'block' : 'none';
  document.getElementById('tab-enquiries').classList.toggle('active', tab === 'enquiries');
  document.getElementById('tab-courses').classList.toggle('active',   tab === 'courses');
  document.getElementById('tab-companies').classList.toggle('active',  tab === 'companies');
  document.getElementById('tab-billing').classList.toggle('active',    tab === 'billing');
  if (tab === 'courses') loadCourses(getCurrentCourseFilter());
  if (tab === 'companies') loadCompanies(getCurrentCompanyFilter());
  if (tab === 'billing') loadInvoices(getCurrentInvoiceFilter());
}

/* ── Login ───────────────────────────────────────────────────────── */
document.getElementById('admin-pwd').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const pwd = document.getElementById('admin-pwd').value;
  if (!pwd) return;
  setPassword(pwd);
  const ok = await loadEnquiries('all', true);
  if (ok) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display    = 'block';
    loadEnquiries('all');
  } else {
    setPassword('');
    document.getElementById('pwd-error').style.display = 'block';
  }
});

/* ── Init modules ────────────────────────────────────────────────── */
initEnquiries();
initVatListener();

/* ── Handle auth success redirect ────────────────────────────────── */
(function() {
  const p = new URLSearchParams(window.location.search);
  if (p.get('auth') === 'success') {
    history.replaceState({}, '', '/admin.html');
  }
})();
