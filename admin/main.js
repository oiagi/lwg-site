/* ── Admin entry point ────────────────────────────────────────────── */
import { TABS } from './constants.js';
import { initAuth, signIn, signOut, getSession } from './auth.js';
import {
  loadCourses,
  getCurrentCourseFilter,
  filterCourses,
  toggleCourse,
  syncCalendar,
  cancelSession,
  saveStudent,
  logSession,
  deleteCourse,
  openAttendanceModal,
  closeAttendanceModal,
  submitAttendance,
  openAddParticipantModal,
  closeAddParticipantModal,
  submitAddParticipant,
  initAddParticipantSearch,
  sendCourseConfirmation,
  sendStudentSchedule,
  openCertificateModal,
  toggleCourseAddressEditor,
  saveCourseAddress,
} from './courses.js';
import { closeCertificateModal, submitCertificates } from './certificates.js';
import {
  loadStudents,
  getCurrentStudentFilter,
  filterStudents,
  selectStudent,
  selectStudentFromCourse,
  backToCourse,
  editStudent,
  deleteStudent,
  copyIntakeLink,
  openEnrollStudentModal,
  closeEnrollStudentModal,
  submitEnrollStudent,
} from './students.js';
import {
  exportStudents,
  openImportModal,
  closeImportModal,
  handleImportFile,
  submitImport,
} from './excel.js';
import { authoriseTeacher, setOnAuthoriseComplete } from './teachers.js';
import { loadAvailability, onTeacherSelect } from './availability.js';
import { trapFocus, releaseFocus } from './helpers.js';
import { closeConfirmSend, submitConfirmSend } from './confirm-send.js';

/* ── Refresh availability banner after OAuth ─────────────────────── */
setOnAuthoriseComplete(() => {
  const panel = document.getElementById('panel-teachers');
  if (panel && panel.style.display !== 'none') {
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
  saveStudent,
  logSession,
  deleteCourse,
  openAttendanceModal,
  closeAttendanceModal,
  submitAttendance,
  openAddParticipantModal,
  closeAddParticipantModal,
  submitAddParticipant,
  sendCourseConfirmation,
  sendStudentSchedule,
  openCertificateModal,
  closeCertificateModal,
  submitCertificates,
  toggleCourseAddressEditor,
  saveCourseAddress,
  // Confirm-send modal
  closeConfirmSendModal: closeConfirmSend,
  submitConfirmSend,
  // Students
  filterStudents,
  selectStudent,
  selectStudentFromCourse,
  backToCourse,
  editStudent,
  deleteStudent,
  copyIntakeLink,
  openEnrollStudentModal,
  closeEnrollStudentModal,
  submitEnrollStudent,
  exportStudents,
  openImportModal,
  closeImportModal,
  handleImportFile,
  submitImport,
  // Teachers
  authoriseTeacher,
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

/* ── Tab switching ───────────────────────────────────────────────── */
function switchTab(tab, options = {}) {
  const tabs = TABS;
  for (const t of tabs) {
    document.getElementById('panel-' + t).style.display = tab === t ? 'block' : 'none';
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
  if (tab === 'students' && !options.skipReload) loadStudents(getCurrentStudentFilter());
  if (tab === 'teachers') loadAvailability();
}

document.addEventListener('admin:switchTab', (e) => {
  const { tab, ...rest } = e.detail || {};
  if (tab) switchTab(tab, rest);
});

/* ── Show dashboard ──────────────────────────────────────────────── */
function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  const hash = window.location.hash.replace('#', '');
  const tab = TABS.includes(hash) ? hash : 'students';
  if (hash && TABS.includes(hash)) history.replaceState({}, '', '/admin.html');
  switchTab(tab);
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
    document.getElementById('pwd-error').style.display = 'none';
    showDashboard();
  } catch {
    document.getElementById('pwd-error').style.display = 'block';
  }
});

/* ── Logout ──────────────────────────────────────────────────────── */
document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('login-screen').style.display = 'block';
  document.getElementById('admin-email').value = '';
  document.getElementById('admin-pwd').value = '';
});

/* ── Init ────────────────────────────────────────────────────────── */
initAddParticipantSearch();

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
