/* ── Students page entry ─────────────────────────────────────────── */
import { initDashboard, registerActions } from './dashboard-shell.js';
import {
  loadStudents,
  getCurrentStudentFilter,
  filterStudents,
  selectStudent,
  backToCourse,
  editStudent,
  deleteStudent,
  copyIntakeLink,
  openEnrollStudentModal,
  closeEnrollStudentModal,
  submitEnrollStudent,
  applyFromCourseContext,
} from './students.js';
import {
  exportStudents,
  openImportModal,
  closeImportModal,
  handleImportFile,
  submitImport,
} from './excel.js';

registerActions({
  filterStudents,
  selectStudent,
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
});

(async function () {
  if (!(await initDashboard())) return;
  const ctxRaw = sessionStorage.getItem('admin:openStudent');
  if (ctxRaw) {
    sessionStorage.removeItem('admin:openStudent');
    try {
      const { studentId, courseId, courseCode } = JSON.parse(ctxRaw);
      await applyFromCourseContext(studentId, courseId, courseCode);
      return;
    } catch {
      // fall through to default load
    }
  }
  loadStudents(getCurrentStudentFilter());
})();
