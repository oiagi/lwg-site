// form-validate.js
// Shared client-side form validation helpers.
// Used by contact.html, intake.js, and potentially booking.html.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Check if a value looks like a valid email.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value);
}

/**
 * Show or hide a field error element by ID.
 * @param {string} id  — ID of the error element
 * @param {boolean} show — true to show, false to hide
 */
export function showFieldError(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'block' : 'none';
}

/**
 * Hide all error elements within a container.
 * @param {HTMLElement|string} container — element or ID
 */
export function clearErrors(container) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) return;
  for (const err of el.querySelectorAll('.error')) {
    err.style.display = 'none';
  }
}
