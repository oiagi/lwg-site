/* ── Shared constants for the admin dashboard ─────────────────────── */

/* Enquiry statuses */
export const ENQUIRY_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

/* Course statuses */
export const COURSE_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/* Session statuses */
export const SESSION_STATUS = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/* Invoice statuses */
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

/* Service types */
export const SERVICE_TYPES = {
  LANGUAGE: 'language course',
  EXAM: 'exam prep',
  TUTORING: 'tutoring',
};

/* Course levels */
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/* Group types */
export const GROUP_TYPES = {
  PRIVATE: 'private',
  DUO: 'duo',
  GROUP: 'group',
};

/* Default currency */
export const DEFAULT_CURRENCY = 'CHF';

/* Default session duration in minutes */
export const DEFAULT_SESSION_DURATION = 50;

/* Admin dashboard tabs */
export const TABS = [
  'enquiries',
  'courses',
  'students',
  'companies',
  'billing',
  'reports',
  'teachers',
];
