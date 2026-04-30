/* ── Courses page entry ──────────────────────────────────────────── */
import { initDashboard, registerActions } from './dashboard-shell.js';
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
import { closeConfirmSend, submitConfirmSend } from './confirm-send.js';
import { selectStudentFromCourse } from './students.js';

registerActions({
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
  closeConfirmSendModal: closeConfirmSend,
  submitConfirmSend,
  selectStudentFromCourse,
});

initAddParticipantSearch();

(async function () {
  if (!(await initDashboard())) return;
  const openCourseId = sessionStorage.getItem('admin:openCourse');
  if (openCourseId) sessionStorage.removeItem('admin:openCourse');
  await loadCourses(getCurrentCourseFilter());
  if (openCourseId) {
    const detail = document.getElementById('course-detail-' + openCourseId);
    if (detail) {
      detail.classList.add('open');
      const row = document.getElementById('course-' + openCourseId);
      if (row) row.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }
})();
