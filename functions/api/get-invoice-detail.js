// functions/api/get-invoice-detail.js
// GET /api/get-invoice-detail?id=<uuid>
//
// Returns a single invoice with line items and company details.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';
import { formatQrReference } from './_qr-utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id  = url.searchParams.get('id');
  if (!id) return errorResponse('Missing id parameter', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    // ── Load invoice ──────────────────────────────────────────────────
    const invRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?id=eq.${id}&select=*`,
      { headers: H }
    );
    const invoices = await invRes.json();
    if (!invoices.length) return errorResponse('Invoice not found', 404);
    const invoice = invoices[0];

    // ── Load lines ────────────────────────────────────────────────────
    const linesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoice_lines?invoice_id=eq.${id}&order=description.asc&select=*`,
      { headers: H }
    );
    const lines = linesRes.ok ? await linesRes.json() : [];

    // ── Load company ──────────────────────────────────────────────────
    const compRes = await fetch(
      `${SUPABASE_URL}/rest/v1/companies?id=eq.${invoice.company_id}&select=*`,
      { headers: H }
    );
    const companies = await compRes.json();
    const company = companies[0] || {};

    return jsonResponse({
      ...invoice,
      qr_reference_formatted: invoice.qr_reference ? formatQrReference(invoice.qr_reference) : null,
      lines,
      company,
    });
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}
