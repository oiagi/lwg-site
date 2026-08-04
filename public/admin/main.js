/* ── Admin entry point ────────────────────────────────────────────── */
import { TABS } from './core/constants.js';
import { initAuth, signIn, signOut, getSession } from './core/auth.js';
import {
  loadCourses,
  getCurrentCourseFilter,
  filterCourses,
  toggleCourse,
  syncCalendar,
  cancelSession,
  toggleStatusDropdown,
  setCourseStatus,
  saveStudent,
  saveEnrolmentSettings,
  logSession,
  deleteCourse,
  removeStudentFromCourse,
  openAttendanceModal,
  closeAttendanceModal,
  submitAttendance,
  openAddParticipantModal,
  closeAddParticipantModal,
  submitAddParticipant,
  initAddParticipantSearch,
  sendCourseConfirmation,
  openScheduleModal,
  openCertificateModal,
  openContractModal,
  openInvoiceModal,
  openBulkInvoiceModal,
  toggleCourseAddressEditor,
  saveCourseAddress,
  togglePublicBooking,
  toggleCompanyCodeBooking,
  handleCourseBooking,
  openGroupSlotModal,
  closeGroupSlotModal,
  submitGroupSlot,
  setGroupSlotStatus,
  togglePublicSlotsPanel,
  openEditGroupSlotModal,
  deleteGroupSlot,
} from './features/courses.js?v=invoice-cancel-20260804';
import { closeCertificateModal } from './features/certificates.js?v=cert-submit-20260601';
import { closeContractModal, downloadSignedContract } from './features/contracts.js';
import {
  closeInvoiceModal,
  submitInvoice,
  downloadInvoice,
  prevBulkPreview,
  nextBulkPreview,
} from './features/invoices.js?v=invoice-cancel-20260804';
import {
  loadStudents,
  getCurrentStudentFilter,
  filterStudents,
  selectStudent,
  selectStudentFromCourse,
  backToCourse,
  openRequestCourse,
  editStudent,
  deleteStudent,
  removeStudentEnrolment,
  copyDetailValue,
  copyIntakeLink,
  sendIntakeLink,
  markIntakeSeen,
  handleStudentRequestBooking,
  markStudentEnquiryTreated,
  openEnrolStudentModal,
  closeEnrolStudentModal,
  submitEnrolStudent,
  initStudentTabFlag,
} from './features/students.js';
import {
  exportStudents,
  openImportModal,
  closeImportModal,
  handleImportFile,
  submitImport,
} from './features/excel.js';
import { authoriseTeacher, setOnAuthoriseComplete } from './features/teachers.js';
import {
  loadAvailability,
  onTeacherSelect,
  addBlockedDate,
  deleteBlockedDate,
} from './features/availability.js';
import { trapFocus, releaseFocus } from './core/helpers.js';
import { closeConfirmSend, submitConfirmSend } from './features/confirm-send.js';
import {
  loadInvoiceArchive,
  switchArchiveYear,
  switchArchiveView,
  toggleInvoiceActions,
  sendInvoiceReminder,
  markArchivedInvoicePaid,
  openCancelInvoiceModal,
  closeCancelInvoiceModal,
  submitCancelInvoice,
  deleteInvoice,
} from './features/invoice-archive.js?v=invoice-cancel-20260804';
import {
  loadCompanies,
  selectCompany,
  saveCompanyName,
  saveCompanyCode,
  openSendBookingCode,
  copyCompanyIntakeLink,
  openSendCompanyIntakeLink,
  openNewCompanyModal,
  closeNewCompanyModal,
  submitNewCompany,
  openAddStudentModal,
  closeAddStudentModal,
  pickAddStudent,
  confirmAddStudent,
  toggleCreateStudentForm,
  submitCreateAndAddStudent,
  removeStudentFromCompany,
  openLinkCourseModal,
  closeLinkCourseModal,
  pickLinkCourse,
  confirmLinkCourse,
  unlinkCourseFromCompany,
  navigateToCourse,
} from './features/companies.js';
import {
  loadReviews,
  filterReviews,
  saveReview,
  toggleReviewApproval,
  deleteReview,
} from './features/reviews.js';

/* ── Refresh availability banner after OAuth ─────────────────────── */
setOnAuthoriseComplete(() => {
  const panel = document.getElementById('panel-teachers');
  if (panel && !panel.classList.contains('is-hidden')) {
    onTeacherSelect();
  }
});

/* ── Action registry for event delegation ─────────────────────────── */
const actions = {
  // Courses
  filterCourses,
  toggleCourse,
  syncCalendar,
  cancelSession,
  toggleStatusDropdown,
  setCourseStatus,
  saveStudent,
  saveEnrolmentSettings,
  logSession,
  deleteCourse,
  removeStudentFromCourse,
  openAttendanceModal,
  closeAttendanceModal,
  submitAttendance,
  openAddParticipantModal,
  closeAddParticipantModal,
  submitAddParticipant,
  sendCourseConfirmation,
  openScheduleModal,
  openCertificateModal,
  closeCertificateModal,
  openContractModal,
  closeContractModal,
  downloadSignedContract,
  openInvoiceModal,
  openBulkInvoiceModal,
  closeInvoiceModal,
  submitInvoice,
  downloadInvoice,
  prevBulkPreview,
  nextBulkPreview,
  toggleCourseAddressEditor,
  saveCourseAddress,
  togglePublicBooking,
  toggleCompanyCodeBooking,
  handleCourseBooking,
  openGroupSlotModal,
  closeGroupSlotModal,
  submitGroupSlot,
  setGroupSlotStatus,
  togglePublicSlotsPanel,
  openEditGroupSlotModal,
  deleteGroupSlot,
  // Confirm-send modal
  closeConfirmSendModal: closeConfirmSend,
  submitConfirmSend,
  // Students
  filterStudents,
  selectStudent,
  selectStudentFromCourse,
  backToCourse,
  openRequestCourse,
  editStudent,
  deleteStudent,
  removeStudentEnrolment,
  copyDetailValue,
  copyIntakeLink,
  sendIntakeLink,
  markIntakeSeen,
  handleStudentRequestBooking,
  markStudentEnquiryTreated,
  openEnrolStudentModal,
  closeEnrolStudentModal,
  submitEnrolStudent,
  exportStudents,
  openImportModal,
  closeImportModal,
  handleImportFile,
  submitImport,
  // Teachers
  authoriseTeacher,
  // Availability
  onTeacherSelect,
  addBlockedDate,
  deleteBlockedDate,
  // Invoice archive
  switchArchiveYear,
  switchArchiveView,
  toggleInvoiceActions,
  sendInvoiceReminder,
  markArchivedInvoicePaid,
  openCancelInvoiceModal,
  closeCancelInvoiceModal,
  submitCancelInvoice,
  deleteInvoice,
  // Companies
  selectCompany,
  saveCompanyName,
  saveCompanyCode,
  openSendBookingCode,
  copyCompanyIntakeLink,
  openSendCompanyIntakeLink,
  openNewCompanyModal,
  closeNewCompanyModal,
  submitNewCompany,
  openAddStudentModal,
  closeAddStudentModal,
  pickAddStudent,
  confirmAddStudent,
  toggleCreateStudentForm,
  submitCreateAndAddStudent,
  removeStudentFromCompany,
  openLinkCourseModal,
  closeLinkCourseModal,
  pickLinkCourse,
  confirmLinkCourse,
  unlinkCourseFromCompany,
  navigateToCourse,
  // Reviews
  filterReviews,
  saveReview,
  toggleReviewApproval,
  deleteReview,
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

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const name = el.dataset.action;
  const fn = actions[name];
  if (!fn) return;
  e.preventDefault();
  const args = el.dataset.args ? el.dataset.args.split(',') : [];
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

/* ── Modal observer (defined early so loadPanel can use it) ──────── */
const modalObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
    const el = m.target;
    if (!el.classList.contains('modal-overlay')) continue;
    if (el.classList.contains('open')) {
      const modal = el.querySelector('.modal');
      el.scrollTop = 0;
      if (modal) {
        modal.scrollTop = 0;
        trapFocus(modal);
      }
    } else {
      releaseFocus();
    }
  }
});

// Observe modals that are in index.html (not injected by loadPanel).
for (const overlay of document.querySelectorAll('.modal-overlay')) {
  modalObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
}

/* ── Panel lazy-loader ───────────────────────────────────────────── */
const loadedPanels = new Set();

function mountPanelModals(container) {
  for (const overlay of container.querySelectorAll('.modal-overlay')) {
    document.body.appendChild(overlay);
    modalObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }
}

async function loadPanel(tab) {
  if (loadedPanels.has(tab)) return;
  const res = await fetch(`/admin/panels/${tab}.html`);
  const html = await res.text();
  const container = document.getElementById('panel-' + tab);
  container.innerHTML = html;
  loadedPanels.add(tab);
  mountPanelModals(container);
  if (tab === 'courses') initAddParticipantSearch();
}

/* ── Hash parsing ────────────────────────────────────────────────── */
function parseHash() {
  const [tab, id] = window.location.hash.replace('#', '').split('/');
  return { tab: TABS.includes(tab) ? tab : null, id: id || null };
}

/* ── Tab switching ───────────────────────────────────────────────── */
async function switchTab(tab, options = {}) {
  if (!options.skipHistoryUpdate) {
    const method = options.replaceHistory ? 'replaceState' : 'pushState';
    let hash = '#' + tab;
    if (tab === 'students' && options.studentId) hash += '/' + options.studentId;
    else if (tab === 'courses' && options.openCourseId) hash += '/' + options.openCourseId;
    history[method]({}, '', hash);
  }
  await loadPanel(tab);
  const tabs = TABS;
  for (const t of tabs) {
    document.getElementById('panel-' + t).classList.toggle('is-hidden', tab !== t);
    document.getElementById('tab-' + t).classList.toggle('active', tab === t);
  }
  if (tab === 'courses') {
    loadCourses(getCurrentCourseFilter()).then(() => {
      if (options.openCourseId) {
        const detail = document.getElementById('course-detail-' + options.openCourseId);
        if (detail) {
          detail.classList.add('open');
          const row = document.getElementById('course-' + options.openCourseId);
          if (row) row.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }
    });
  }
  if (tab === 'students') {
    if (options.studentId) {
      await loadStudents(getCurrentStudentFilter());
      selectStudent(options.studentId, { updateUrl: false });
    } else if (!options.skipReload) {
      loadStudents(getCurrentStudentFilter());
    }
  }
  if (tab === 'teachers') loadAvailability();
  if (tab === 'invoices') loadInvoiceArchive();
  if (tab === 'companies') loadCompanies();
  if (tab === 'reviews') loadReviews();
}

document.addEventListener('admin:switchTab', (e) => {
  const { tab, ...rest } = e.detail || {};
  if (tab) switchTab(tab, rest);
});

window.addEventListener('popstate', () => {
  const { tab, id } = parseHash();
  const activeTab = tab || 'students';
  const options = { skipHistoryUpdate: true };
  if (id) {
    if (activeTab === 'students') options.studentId = id;
    if (activeTab === 'courses') options.openCourseId = id;
  }
  switchTab(activeTab, options);
});

/* ── Show dashboard ──────────────────────────────────────────────── */
async function showDashboard() {
  document.getElementById('login-screen').classList.add('is-hidden');
  document.getElementById('dashboard').classList.add('is-visible-block');
  const { tab, id } = parseHash();
  const activeTab = tab || 'students';
  const options = { replaceHistory: true };
  if (id) {
    if (activeTab === 'students') options.studentId = id;
    if (activeTab === 'courses') options.openCourseId = id;
  }
  if (activeTab !== 'students') initStudentTabFlag();
  await switchTab(activeTab, options);
}

/* ── Login ───────────────────────────────────────────────────────── */
document.getElementById('admin-pwd').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('admin-email').value.trim();
  const pwd = document.getElementById('admin-pwd').value;
  if (!email || !pwd) return;

  try {
    await signIn(email, pwd);
    document.getElementById('pwd-error').classList.remove('is-visible-block');
    showDashboard();
  } catch {
    document.getElementById('pwd-error').classList.add('is-visible-block');
  }
});

/* ── Logout ──────────────────────────────────────────────────────── */
document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  document.getElementById('dashboard').classList.remove('is-visible-block');
  document.getElementById('login-screen').classList.remove('is-hidden');
  document.getElementById('admin-email').value = '';
  document.getElementById('admin-pwd').value = '';
});

/* ── Bootstrap: init Supabase, check existing session ────────────── */
(async function () {
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
(function () {
  const p = new URLSearchParams(window.location.search);
  if (p.get('auth') === 'success') {
    history.replaceState({}, '', '/admin');
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
