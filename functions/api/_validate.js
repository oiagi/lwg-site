// functions/api/_validate.js
// Lightweight request-body validation for API endpoints.
//
// Usage:
//   import { validate } from './_validate.js';
//   const err = validate(body, { name: { required: true, type: 'string', maxLength: 200 } });
//   if (err) return errorResponse(err, 400);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALIDATORS = {
  required(value) {
    return value !== undefined && value !== null && value !== '';
  },
  type(value, expected) {
    if (value === undefined || value === null) return true; // checked by required
    if (expected === 'string') return typeof value === 'string';
    if (expected === 'number') return typeof value === 'number' && !Number.isNaN(value);
    if (expected === 'boolean') return typeof value === 'boolean';
    if (expected === 'object') return typeof value === 'object' && !Array.isArray(value);
    if (expected === 'array') return Array.isArray(value);
    return true;
  },
  maxLength(value, max) {
    if (typeof value !== 'string') return true;
    return value.length <= max;
  },
  email(value) {
    if (typeof value !== 'string') return false;
    return EMAIL_RE.test(value);
  },
  oneOf(value, allowed) {
    return allowed.includes(value);
  },
};

/**
 * Validate a body object against a schema.
 *
 * @param {object} body   - The parsed request body.
 * @param {object} schema - Field rules, e.g.:
 *   {
 *     name:    { required: true, type: 'string', maxLength: 200 },
 *     email:   { required: true, type: 'string', email: true },
 *     service: { required: true, type: 'string', oneOf: ['language course', 'exam prep', 'tutoring'] },
 *   }
 * @returns {string|null} Error message or null if valid.
 */
export function validate(body, schema) {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object';
  }

  for (const [field, rules] of Object.entries(schema)) {
    const value = body[field];

    if (rules.required && !VALIDATORS.required(value)) {
      return `${field} is required`;
    }

    if (value !== undefined && value !== null && value !== '') {
      if (rules.type && !VALIDATORS.type(value, rules.type)) {
        return `${field} must be a ${rules.type}`;
      }
      if (rules.maxLength && !VALIDATORS.maxLength(value, rules.maxLength)) {
        return `${field} must be at most ${rules.maxLength} characters`;
      }
      if (rules.email && !VALIDATORS.email(value)) {
        return `${field} must be a valid email address`;
      }
      if (rules.oneOf && !VALIDATORS.oneOf(value, rules.oneOf)) {
        return `${field} must be one of: ${rules.oneOf.join(', ')}`;
      }
    }
  }

  return null;
}
