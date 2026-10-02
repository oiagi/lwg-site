// functions/api/get-qr-bill-config.js
// GET /api/get-qr-bill-config
//
// Returns the creditor side of the Swiss QR-bill the admin generates for each
// invoice: { iban, creditor: { name, street, buildingNumber, postalCode, city,
// country } }. The IBAN comes from the QR_BILL_IBAN environment variable and
// must be a QR-IBAN (the bill carries a QR reference); the creditor name from
// QR_BILL_CREDITOR_NAME (account holder as registered with the bank), the
// address from the verified business facts in _schema.js.
//
// Responds 503 with a plain message while the variable is missing or invalid,
// so the admin can explain what to configure instead of sending bills without
// a payment part.

import { requireAdminAuth, jsonResponse, errorResponse, withErrorHandling } from './_utils.js';
import { BUSINESS } from '../_schema.js';
import { isValidIban, isQrIban, normaliseIban } from '../../public/admin/core/swiss-qr-bill.js';

const DEFAULT_CREDITOR_NAME = 'Birukoff World c/o Gioia Birukoff';

// "Wildbachstrasse 65" → { street: 'Wildbachstrasse', buildingNumber: '65' }.
export function splitStreet(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(.*\S)\s+(\d[\w/.-]*)$/);
  if (!match) return { street: text, buildingNumber: '' };
  return { street: match[1], buildingNumber: match[2] };
}

export function qrBillConfigFromEnv(env) {
  const iban = normaliseIban(env.QR_BILL_IBAN);
  if (!iban) return { error: 'QR_BILL_IBAN is not set' };
  if (!isValidIban(iban)) return { error: 'QR_BILL_IBAN is not a valid Swiss IBAN' };
  if (!isQrIban(iban)) {
    return { error: 'QR_BILL_IBAN must be a QR-IBAN (positions 5–9 between 30000 and 31999)' };
  }
  const name = String(env.QR_BILL_CREDITOR_NAME ?? '').trim() || DEFAULT_CREDITOR_NAME;
  const { street, buildingNumber } = splitStreet(BUSINESS.street);
  return {
    iban,
    creditor: {
      name,
      street,
      buildingNumber,
      postalCode: BUSINESS.postalCode,
      city: BUSINESS.city,
      country: BUSINESS.country,
    },
  };
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const config = qrBillConfigFromEnv(env);
  if (config.error) return errorResponse(config.error, 503);
  return jsonResponse(config);
}, 'get-qr-bill-config');
