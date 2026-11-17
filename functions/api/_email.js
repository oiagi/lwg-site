// functions/api/_email.js
// Shared Resend email sending. Every outgoing email goes through
// sendResendEmail(); call sites keep their own guards (missing key,
// missing recipient) and response handling.

// Single source of truth for the address we send from, reply to and print.
// Changing it here moves the sender, every reply_to and the ICS organizer at once.
export const CONTACT_EMAIL = 'info@learningwithgioia.ch';
export const FROM_EMAIL = `learning with gioia <${CONTACT_EMAIL}>`;
export const NOTIFY_EMAILS = [CONTACT_EMAIL];

/**
 * The response of a send endpoint called with `preview: true`: the exact
 * subject and HTML the recipient would get, built by the same code as the
 * real send. Nothing is sent or stored for a preview.
 */
export function previewResponse({ to, subject, html, attachment = null, note = null }) {
  return new Response(JSON.stringify({ preview: true, to, subject, html, attachment, note }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST a message to the Resend API.
 *
 * @param {string} apiKey  - env.RESEND_API_KEY
 * @param {object} message - Raw Resend payload (to, subject, html, reply_to,
 *   attachments, …). `from` defaults to FROM_EMAIL.
 * @returns {Promise<Response>} The raw fetch response — callers decide how
 *   to handle failures (await + res.ok check, or fire-and-forget).
 */
export function sendResendEmail(apiKey, message) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, ...message }),
  });
}
