// functions/api/create-invoice.js
// POST /api/create-invoice
// Body: { company_id, session_ids[], notes?, vat_rate? }
//
// Creates a new invoice for a company, linking completed sessions as line items.
// Generates invoice number, QR reference, and calculates totals.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD, QR_IBAN

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';
import { generateQrReference, nextInvoiceNumber } from './_qr-utils.js';

export async function onRequestPost({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  const { company_id, student_id, session_ids, notes, vat_rate } = body;
  if (!company_id && !student_id) return errorResponse('Missing company_id or student_id', 400);
  if (company_id && student_id) return errorResponse('Provide either company_id or student_id, not both', 400);
  if (!session_ids || !session_ids.length) return errorResponse('At least one session is required', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    // ── Load company or student ─────────────────────────────────────────
    let rate, currency, billedEntity;

    if (company_id) {
      const compRes = await fetch(
        `${SUPABASE_URL}/rest/v1/companies?id=eq.${company_id}&select=*`,
        { headers: H }
      );
      const companies = await compRes.json();
      if (!companies.length) return errorResponse('Company not found', 404);
      billedEntity = companies[0];

      if (!billedEntity.rate_per_session) {
        return errorResponse('Company has no rate_per_session configured', 400);
      }
      rate = parseFloat(billedEntity.rate_per_session);
      currency = billedEntity.currency || 'CHF';
    } else {
      const stuRes = await fetch(
        `${SUPABASE_URL}/rest/v1/students?id=eq.${student_id}&select=*`,
        { headers: H }
      );
      const students = await stuRes.json();
      if (!students.length) return errorResponse('Student not found', 404);
      billedEntity = students[0];

      if (!billedEntity.rate_per_session) {
        return errorResponse('Student has no rate_per_session configured', 400);
      }
      rate = parseFloat(billedEntity.rate_per_session);
      currency = billedEntity.currency || 'CHF';
    }

    // ── Load sessions ──────────────────────────────────────────────────
    const sessionFilter = session_ids.map(id => `id.eq.${id}`).join(',');
    const sessRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?or=(${sessionFilter})&select=id,course_id,scheduled_at,duration_minutes,status`,
      { headers: H }
    );
    const sessions = await sessRes.json();

    if (!sessions.length) return errorResponse('No sessions found', 404);

    // Load course info for descriptions
    const courseIds = [...new Set(sessions.map(s => s.course_id))];
    const courseFilter = courseIds.map(id => `id.eq.${id}`).join(',');
    const courseRes = await fetch(
      `${SUPABASE_URL}/rest/v1/courses?or=(${courseFilter})&select=id,course_code,service,level`,
      { headers: H }
    );
    const courses = await courseRes.json();
    const courseMap = {};
    courses.forEach(c => { courseMap[c.id] = c; });

    // ── Generate invoice number ────────────────────────────────────────
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?select=invoice_number&order=created_at.desc&limit=100`,
      { headers: H }
    );
    const existingInvoices = await existingRes.json();
    const existingNumbers = existingInvoices.map(i => i.invoice_number);
    const invoiceNumber = nextInvoiceNumber(existingNumbers);

    // ── Calculate totals ───────────────────────────────────────────────
    const vatRateVal = vat_rate !== undefined ? parseFloat(vat_rate) : null;

    const lines = sessions.map(s => {
      const course = courseMap[s.course_id] || {};
      const dateStr = s.scheduled_at
        ? new Date(s.scheduled_at).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';
      const desc = [course.course_code, course.service, course.level, dateStr]
        .filter(Boolean).join(' — ');
      return {
        session_id:  s.id,
        description: desc,
        quantity:    1,
        unit_price:  rate,
        line_total:  rate,
      };
    });

    const netAmount = lines.reduce((sum, l) => sum + l.line_total, 0);
    const vatAmount = vatRateVal ? Math.round(netAmount * vatRateVal / 100 * 100) / 100 : 0;
    const totalAmount = Math.round((netAmount + vatAmount) * 100) / 100;

    // ── Generate QR reference ──────────────────────────────────────────
    const qrReference = generateQrReference(invoiceNumber);
    const qrIban = env.QR_IBAN || '';

    // ── Insert invoice ─────────────────────────────────────────────────
    const invoiceData = {
      invoice_number: invoiceNumber,
      company_id:  company_id || null,
      student_id:  student_id || null,
      issued_date:  new Date().toISOString().slice(0, 10),
      due_date:     new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      status:       'draft',
      currency,
      net_amount:   netAmount,
      vat_rate:     vatRateVal,
      vat_amount:   vatAmount,
      total_amount: totalAmount,
      qr_reference: qrReference,
      qr_iban:      qrIban,
      notes:        notes || null,
    };

    const invRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices`,
      {
        method:  'POST',
        headers: { ...H, 'Prefer': 'return=representation' },
        body:    JSON.stringify(invoiceData),
      }
    );
    if (!invRes.ok) {
      console.error('Invoice insert error:', await invRes.text());
      return errorResponse('Could not create invoice');
    }
    const [invoice] = await invRes.json();

    // ── Insert line items ──────────────────────────────────────────────
    const lineRows = lines.map(l => ({
      invoice_id: invoice.id,
      session_id: l.session_id,
      description: l.description,
      quantity:    l.quantity,
      unit_price:  l.unit_price,
      line_total:  l.line_total,
    }));

    const linesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoice_lines`,
      {
        method:  'POST',
        headers: { ...H, 'Prefer': 'return=representation' },
        body:    JSON.stringify(lineRows),
      }
    );
    if (!linesRes.ok) {
      console.error('Invoice lines insert error:', await linesRes.text());
    }
    const insertedLines = linesRes.ok ? await linesRes.json() : [];

    return jsonResponse({ ...invoice, lines: insertedLines });
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}
