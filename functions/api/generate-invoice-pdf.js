// functions/api/generate-invoice-pdf.js
// GET /api/generate-invoice-pdf?id=<uuid>
//
// Generates a Swiss QR bill-compliant PDF invoice.
// The QR payment slip is rendered at the bottom of the page per IG QR-bill v2.3.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY,
//   QR_IBAN, CREDITOR_NAME, CREDITOR_STREET, CREDITOR_HOUSE_NUMBER,
//   CREDITOR_POSTAL_CODE, CREDITOR_CITY, CREDITOR_COUNTRY

import { supabaseHeaders, requireAdminAuth, errorResponse } from './_utils.js';
import { formatQrReference, buildQrPayload } from './_qr-utils.js';
import { PdfBuilder, parseAddress } from './_pdf-builder.js';

// ── Render the invoice body (header, line items, totals) ────────────────

function renderInvoiceBody(pdf, invoice, lines, debtor, creditor, margin, right) {
  const PAGE_H = 841.89;

  let y = PAGE_H - margin;
  pdf.text(margin, y, creditor.name, { font: 'bold', size: 14 });
  y -= 16;
  if (creditor.street) { pdf.text(margin, y, creditor.street, { size: 9 }); y -= 12; }
  if (creditor.city)   { pdf.text(margin, y, creditor.city, { size: 9 }); y -= 12; }
  y -= 10;

  // Recipient
  const recipientY = PAGE_H - margin - 5;
  pdf.text(350, recipientY, debtor.name || '', { font: 'bold', size: 10 });
  if (debtor.billing_address) {
    pdf.text(350, recipientY - 14, debtor.billing_address, { size: 9 });
  }

  // Invoice title
  y -= 30;
  pdf.text(margin, y, `Invoice ${invoice.invoice_number}`, { font: 'bold', size: 16 });
  y -= 24;

  // Metadata
  const meta = [
    ['Date', invoice.issued_date], ['Due', invoice.due_date],
    ['Currency', invoice.currency], ['Status', invoice.status],
  ];
  if (debtor.vat_number) meta.push(['VAT No.', debtor.vat_number]);

  for (const [label, val] of meta) {
    pdf.text(margin, y, `${label}:`, { font: 'bold', size: 8 });
    pdf.text(margin + 60, y, val || '—', { size: 8 });
    y -= 13;
  }
  y -= 10;

  // Line items table header
  pdf.line(margin, y, right, y);
  y -= 12;
  pdf.text(margin, y, 'Description', { font: 'bold', size: 8 });
  pdf.text(380, y, 'Qty', { font: 'bold', size: 8 });
  pdf.text(420, y, 'Unit price', { font: 'bold', size: 8 });
  pdf.text(490, y, 'Total', { font: 'bold', size: 8 });
  y -= 4;
  pdf.line(margin, y, right, y);
  y -= 14;

  for (const line of lines) {
    const desc = (line.description || '').slice(0, 60);
    pdf.text(margin, y, desc, { size: 8 });
    pdf.text(380, y, String(line.quantity), { size: 8 });
    pdf.text(420, y, line.unit_price.toFixed(2), { size: 8 });
    pdf.text(490, y, line.line_total.toFixed(2), { size: 8 });
    y -= 14;
  }

  // Totals
  pdf.line(margin, y, right, y);
  y -= 14;
  pdf.text(420, y, 'Net:', { font: 'bold', size: 9 });
  pdf.text(490, y, `${invoice.currency} ${invoice.net_amount.toFixed(2)}`, { size: 9 });
  y -= 14;

  if (invoice.vat_rate) {
    pdf.text(420, y, `VAT (${invoice.vat_rate}%):`, { font: 'bold', size: 9 });
    pdf.text(490, y, `${invoice.currency} ${invoice.vat_amount.toFixed(2)}`, { size: 9 });
    y -= 14;
  }

  pdf.line(420, y + 2, right, y + 2);
  y -= 2;
  pdf.text(420, y, 'Total:', { font: 'bold', size: 11 });
  pdf.text(490, y, `${invoice.currency} ${invoice.total_amount.toFixed(2)}`, { font: 'bold', size: 11 });
  y -= 20;

  if (invoice.notes) {
    y -= 6;
    pdf.text(margin, y, 'Notes:', { font: 'bold', size: 8 });
    y -= 12;
    pdf.text(margin, y, invoice.notes.slice(0, 200), { size: 8 });
  }
}

// ── Render the Swiss QR bill payment slip (bottom 105mm) ────────────────

function renderQrSlip(pdf, invoice, debtor, creditor, env) {
  const PAGE_W    = 595.28;
  const SLIP_H    = 297.64;   // 105mm in points
  const RECEIPT_W = 175.75;   // 62mm in points
  const QR_SIZE   = 130.39;   // 46mm in points
  const qrIban    = invoice.qr_iban || env.QR_IBAN || '';
  const refFormatted = invoice.qr_reference ? formatQrReference(invoice.qr_reference) : '';

  // Perforation lines
  pdf.dashedLine(0, SLIP_H, PAGE_W, SLIP_H);
  pdf.dashedLine(RECEIPT_W, 0, RECEIPT_W, SLIP_H);

  // ── Receipt section (left) ──────────────────────────────────────────
  let ry = SLIP_H - 14;
  pdf.text(14, ry, 'Receipt', { font: 'bold', size: 11 });
  ry -= 18;

  pdf.text(14, ry, 'Account / Payable to', { font: 'bold', size: 6 });
  ry -= 9;
  pdf.text(14, ry, qrIban, { size: 8 }); ry -= 11;
  pdf.text(14, ry, creditor.name, { size: 8 }); ry -= 11;
  if (creditor.street) { pdf.text(14, ry, creditor.street, { size: 8 }); ry -= 11; }
  pdf.text(14, ry, creditor.city, { size: 8 }); ry -= 16;

  pdf.text(14, ry, 'Reference', { font: 'bold', size: 6 });
  ry -= 9;
  pdf.text(14, ry, refFormatted, { size: 8 }); ry -= 16;

  if (debtor.name) {
    pdf.text(14, ry, 'Payable by', { font: 'bold', size: 6 }); ry -= 9;
    pdf.text(14, ry, debtor.name, { size: 8 }); ry -= 11;
    if (debtor.billing_address) { pdf.text(14, ry, debtor.billing_address, { size: 8 }); ry -= 11; }
  } else {
    pdf.text(14, ry, 'Payable by (name/address)', { font: 'bold', size: 6 }); ry -= 9;
    pdf.rect(14, ry - 70.87, 150, 70.87);
  }

  pdf.text(14, 30, 'Currency', { font: 'bold', size: 6 });
  pdf.text(14, 20, invoice.currency, { size: 8 });
  pdf.text(80, 30, 'Amount', { font: 'bold', size: 6 });
  pdf.text(80, 20, invoice.total_amount.toFixed(2), { size: 8 });
  pdf.text(100, SLIP_H - 14, 'Acceptance point', { font: 'bold', size: 6 });

  // ── Payment section (right) ─────────────────────────────────────────
  const PX = RECEIPT_W + 14;
  let py = SLIP_H - 14;

  pdf.text(PX, py, 'Payment part', { font: 'bold', size: 11 });
  py -= 20;

  // QR code placeholder
  const qrX = PX;
  const qrY = py - QR_SIZE;
  pdf.rect(qrX, qrY, QR_SIZE, QR_SIZE, 0.5);

  // Swiss cross in center
  const crossSize = 19.84;
  const crossX = qrX + (QR_SIZE - crossSize) / 2;
  const crossY = qrY + (QR_SIZE - crossSize) / 2;
  pdf.fillRect(crossX, crossY, crossSize, crossSize);
  pdf.setFillColor(1, 1, 1);
  const armW = crossSize * 0.2;
  const armL = crossSize * 0.6;
  pdf.fillRect(crossX + (crossSize - armL) / 2, crossY + (crossSize - armW) / 2, armL, armW);
  pdf.fillRect(crossX + (crossSize - armW) / 2, crossY + (crossSize - armL) / 2, armW, armL);
  pdf.setFillColor(0, 0, 0);

  pdf.text(qrX + 10, qrY + QR_SIZE / 2 + 30, 'Swiss QR Code', { size: 7 });
  pdf.text(qrX + 10, qrY + QR_SIZE / 2 + 18, 'Scan with banking app', { size: 6 });

  // Right-side text
  const TX = PX + QR_SIZE + 14;
  let ty = py;

  pdf.text(TX, ty, 'Account / Payable to', { font: 'bold', size: 8 }); ty -= 12;
  pdf.text(TX, ty, qrIban, { size: 10 }); ty -= 13;
  pdf.text(TX, ty, creditor.name, { size: 10 }); ty -= 13;
  if (creditor.street) { pdf.text(TX, ty, creditor.street, { size: 10 }); ty -= 13; }
  pdf.text(TX, ty, creditor.city, { size: 10 }); ty -= 18;

  pdf.text(TX, ty, 'Reference', { font: 'bold', size: 8 }); ty -= 12;
  pdf.text(TX, ty, refFormatted, { size: 10 }); ty -= 18;

  pdf.text(TX, ty, 'Additional information', { font: 'bold', size: 8 }); ty -= 12;
  pdf.text(TX, ty, `Invoice ${invoice.invoice_number}`, { size: 10 }); ty -= 18;

  if (debtor.name) {
    pdf.text(TX, ty, 'Payable by', { font: 'bold', size: 8 }); ty -= 12;
    pdf.text(TX, ty, debtor.name, { size: 10 }); ty -= 13;
    if (debtor.billing_address) { pdf.text(TX, ty, debtor.billing_address, { size: 10 }); }
  } else {
    pdf.text(TX, ty, 'Payable by (name/address)', { font: 'bold', size: 8 }); ty -= 12;
    pdf.rect(TX, ty - 70.87, 184.25, 70.87);
  }

  pdf.text(PX, 30, 'Currency', { font: 'bold', size: 8 });
  pdf.text(PX, 16, invoice.currency, { size: 10 });
  pdf.text(PX + 80, 30, 'Amount', { font: 'bold', size: 8 });
  pdf.text(PX + 80, 16, invoice.total_amount.toFixed(2), { size: 10 });

  // Build QR payload for integrations
  const debtorAddress = parseAddress(debtor.billing_address || '');
  return buildQrPayload({
    qrIban,
    creditorName:        creditor.name,
    creditorStreet:      env.CREDITOR_STREET || '',
    creditorHouseNumber: env.CREDITOR_HOUSE_NUMBER || '',
    creditorPostalCode:  env.CREDITOR_POSTAL_CODE || '',
    creditorCity:        env.CREDITOR_CITY || '',
    creditorCountry:     env.CREDITOR_COUNTRY || 'CH',
    amount:              invoice.total_amount,
    currency:            invoice.currency,
    debtorName:          debtor.name,
    debtorStreet:        debtorAddress.street,
    debtorHouseNumber:   debtorAddress.houseNumber,
    debtorPostalCode:    debtorAddress.postalCode,
    debtorCity:          debtorAddress.city,
    debtorCountry:       'CH',
    qrReference:         invoice.qr_reference,
    unstructuredMessage: `Invoice ${invoice.invoice_number}`,
  });
}

// ── Handler ──────────────────────────────────────────────────────────────

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id  = url.searchParams.get('id');
  if (!id) return errorResponse('Missing id parameter', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    // Load invoice + lines + debtor in parallel where possible
    const [invRes, linesRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${id}&select=*`, { headers: H }),
      fetch(`${SUPABASE_URL}/rest/v1/invoice_lines?invoice_id=eq.${id}&order=description.asc&select=*`, { headers: H }),
    ]);

    const invoices = await invRes.json();
    if (!invoices.length) return errorResponse('Invoice not found', 404);
    const invoice = invoices[0];

    const lines = linesRes.ok ? await linesRes.json() : [];

    // Load debtor
    let debtor = {};
    if (invoice.company_id) {
      const compRes = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${invoice.company_id}&select=*`, { headers: H });
      const companies = await compRes.json();
      debtor = companies[0] || {};
    } else if (invoice.student_id) {
      const stuRes = await fetch(`${SUPABASE_URL}/rest/v1/students?id=eq.${invoice.student_id}&select=*`, { headers: H });
      const students = stuRes.ok ? await stuRes.json() : [];
      const student = students[0] || {};
      debtor = {
        name: [student.first_name, student.last_name].filter(Boolean).join(' '),
        billing_address: student.billing_address,
        billing_email: student.billing_email,
        vat_number: student.vat_number,
      };
    }

    // Ensure numeric types
    invoice.net_amount   = parseFloat(invoice.net_amount)   || 0;
    invoice.vat_amount   = parseFloat(invoice.vat_amount)   || 0;
    invoice.total_amount = parseFloat(invoice.total_amount) || 0;
    invoice.vat_rate     = invoice.vat_rate ? parseFloat(invoice.vat_rate) : null;
    for (const line of lines) {
      line.quantity   = parseFloat(line.quantity)   || 0;
      line.unit_price = parseFloat(line.unit_price) || 0;
      line.line_total = parseFloat(line.line_total) || 0;
    }

    // Build PDF
    const creditor = {
      name:   env.CREDITOR_NAME || 'Learning with Gioia',
      street: [env.CREDITOR_STREET, env.CREDITOR_HOUSE_NUMBER].filter(Boolean).join(' '),
      city:   [env.CREDITOR_POSTAL_CODE, env.CREDITOR_CITY].filter(Boolean).join(' '),
    };

    const MARGIN = 56.69;
    const RIGHT  = 595.28 - MARGIN;

    const pdf = new PdfBuilder();
    pdf.init();
    pdf.addPage();

    renderInvoiceBody(pdf, invoice, lines, debtor, creditor, MARGIN, RIGHT);
    const qrPayload = renderQrSlip(pdf, invoice, debtor, creditor, env);

    return new Response(pdf.build(), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
        'X-QR-Payload': btoa(qrPayload),
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return errorResponse('Could not generate PDF');
  }
}
