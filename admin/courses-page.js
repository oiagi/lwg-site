/* ── Courses page entry point ─────────────────────────────────────── */
import { registerActions, initAppShell } from './app-shell.js';
import {
  initCoursesPage,
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
import { selectStudentFromCourse } from './students.js';
import { closeConfirmSend, submitConfirmSend } from './confirm-send.js';

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

initAppShell({
  onReady: () => initCoursesPage(),
});
