/* ── Teachers page entry point ────────────────────────────────────── */
import { registerActions, initAppShell } from './app-shell.js';
import { authoriseTeacher, setOnAuthoriseComplete } from './teachers.js';
import { loadAvailability, onTeacherSelect } from './availability.js';

registerActions({
  authoriseTeacher,
  onTeacherSelect,
});

setOnAuthoriseComplete(() => {
  onTeacherSelect();
});

initAppShell({
  onReady: () => loadAvailability(),
});
