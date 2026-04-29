/* ── Teachers page entry ─────────────────────────────────────────── */
import { initDashboard, registerActions } from './dashboard-shell.js';
import { authoriseTeacher, setOnAuthoriseComplete } from './teachers.js';
import { loadAvailability, onTeacherSelect } from './availability.js';

registerActions({
  authoriseTeacher,
  onTeacherSelect,
});

setOnAuthoriseComplete(() => {
  onTeacherSelect();
});

(async function () {
  if (!(await initDashboard())) return;
  loadAvailability();
})();
