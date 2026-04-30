/* ── Students page entry point ────────────────────────────────────── */
import { registerActions, initAppShell } from './app-shell.js';
import {
  filterStudents,
  selectStudent,
  backToCourse,
  editStudent,
  deleteStudent,
  copyIntakeLink,
  openEnrollStudentModal,
  closeEnrollStudentModal,
  submitEnrollStudent,
  initStudentsPage,
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

initAppShell({
  onReady: () => initStudentsPage(),
});
