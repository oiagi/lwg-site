// functions/api/_email.js
// Shared Resend email sending. Every outgoing email goes through
// sendResendEmail(); call sites keep their own guards (missing key,
// missing recipient) and response handling.

export const FROM_EMAIL = 'learning with gioia <hello@oiagi.org>';

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
