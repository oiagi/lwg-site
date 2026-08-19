// functions/api/invoice-archive.js
// GET /api/invoice-archive?year=2026
//
// Lists archived invoice PDFs for a given year (defaults to current year) and
// returns short-lived signed download URLs (1-hour TTL) for each file.
// Requires admin auth. Files live in the `invoice-archive` Supabase Storage bucket.

import {
  supabaseHeaders,
  requireAdminAuth,
  jsonResponse,
  errorResponse,
  withErrorHandling,
} from './_utils.js';

const BUCKET = 'invoice-archive';
const SIGNED_URL_TTL = 3600;
const LIST_PAGE_SIZE = 500;

function currentYear() {
  return new Date().getFullYear();
}

// Storage list responses are capped per request, so page through them until a
// short page arrives. Without this a busy year silently loses its oldest
// invoices — from the overview and from the bulk exports built on top of it.
async function listYearFiles(env, year) {
  const all = [];
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: `${year}/`,
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'desc' },
      }),
    });
    if (!res.ok) throw new Error(`Storage list failed: ${await res.text()}`);
    const page = await res.json();
    all.push(...page);
    if (page.length < LIST_PAGE_SIZE) return all;
  }
}

// Invoice columns whose migrations are applied by hand and may not exist yet;
// they are dropped from the select (and the query retried) when PostgREST
// reports them missing.
const BASE_INVOICE_COLUMNS = [
  'id',
  'invoice_number',
  'status',
  'total_amount',
  'currency',
  'due_date',
  'issued_date',
  'student_id',
  'course_id',
];
const OPTIONAL_INVOICE_COLUMNS = [
  'reminder_sent_at',
  'sent_at',
  'invoice_language',
  'cancels_invoice_id',
  'cancelled_at',
  'item_subject',
  'item_quantity',
  'item_unit_price',
];

async function fetchInvoiceRecords(env, invoiceNumbers) {
  if (invoiceNumbers.length === 0) return [];
  const list = invoiceNumbers.map((n) => encodeURIComponent(n)).join(',');
  const url = `${env.SUPABASE_URL}/rest/v1/invoices?invoice_number=in.(${list})`;
  let columns = [...BASE_INVOICE_COLUMNS, ...OPTIONAL_INVOICE_COLUMNS];
  for (;;) {
    const res = await fetch(`${url}&select=${columns.join(',')}`, {
      headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
    });
    if (res.ok) return res.json();
    const errorText = await res.text();
    // \b keeps e.g. a missing sent_at from also matching reminder_sent_at.
    const missing = OPTIONAL_INVOICE_COLUMNS.filter(
      (col) => columns.includes(col) && new RegExp(`\\b${col}\\b`).test(errorText)
    );
    if (!missing.length) {
      console.error('invoice-archive DB fetch failed:', errorText);
      return [];
    }
    columns = columns.filter((col) => !missing.includes(col));
  }
}

async function fetchRelatedRecords(env, table, ids, select, fallbackSelect = null) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return {};
  const list = uniqueIds.map((id) => encodeURIComponent(id)).join(',');
  const query = (sel) =>
    fetch(`${env.SUPABASE_URL}/rest/v1/${table}?id=in.(${list})&select=${sel}`, {
      headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
    });
  let res = await query(select);
  if (!res.ok && fallbackSelect) res = await query(fallbackSelect);
  if (!res.ok) {
    console.error(`invoice-archive ${table} fetch failed:`, await res.text());
    return {};
  }
  const rows = await res.json();
  return Object.fromEntries(rows.map((row) => [row.id, row]));
}

async function signPaths(env, paths) {
  if (paths.length === 0) return [];
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/${BUCKET}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paths, expiresIn: SIGNED_URL_TTL }),
  });
  if (!res.ok) throw new Error(`Storage sign failed: ${await res.text()}`);
  return res.json();
}

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const yearParam = url.searchParams.get('year');
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : currentYear();

  let items;
  try {
    items = await listYearFiles(env, year);
  } catch (err) {
    console.error('invoice-archive list error:', err);
    return errorResponse('Could not list invoice archive', 502);
  }

  const files = items.filter((item) => item.id !== null);
  const fullPaths = files.map((f) => `${year}/${f.name}`);
  const invoiceNumbers = files.map((f) => f.name.replace(/\.pdf$/i, ''));

  let signed = [];
  let records = [];
  try {
    [signed, records] = await Promise.all([
      signPaths(env, fullPaths),
      fetchInvoiceRecords(env, invoiceNumbers),
    ]);
  } catch (err) {
    console.error('invoice-archive sign error:', err);
    return errorResponse('Could not generate download links', 502);
  }

  const signedMap = Object.fromEntries(
    signed.map((s) => [s.path, s.signedURL ? `${env.SUPABASE_URL}/storage/v1${s.signedURL}` : null])
  );
  // Students: everything the Storno modal needs to rebuild the recipient block
  // and notification email. The fallback select drops the billing-gender
  // columns (their migration may not be applied yet), matching get-courses.js.
  const [studentMap, courseMap] = await Promise.all([
    fetchRelatedRecords(
      env,
      'students',
      records.map((r) => r.student_id),
      'id,first_name,last_name,gender,gender_note,email,customer_reference,street,street_number,postcode,city,billing_name,billing_gender,billing_gender_note,billing_email,billing_street,billing_street_number,billing_postcode,billing_city',
      'id,first_name,last_name,gender,gender_note,email,customer_reference,street,street_number,postcode,city,billing_name,billing_email,billing_street,billing_street_number,billing_postcode,billing_city'
    ),
    fetchRelatedRecords(
      env,
      'courses',
      records.map((r) => r.course_id),
      'id,course_code,subject,level,course_type,group_type,session_length_minutes,sessions_total',
      'id,course_code,subject,level'
    ),
  ]);
  const recordMap = Object.fromEntries(records.map((r) => [r.invoice_number, r]));

  const result = files.map((f) => {
    const path = `${year}/${f.name}`;
    const invoiceNumber = f.name.replace(/\.pdf$/i, '');
    const record = recordMap[invoiceNumber] || {};
    const student = studentMap[record.student_id] || null;
    const course = courseMap[record.course_id] || null;
    return {
      name: f.name,
      path,
      size: f.metadata?.size ?? null,
      created_at: f.created_at,
      signed_url: signedMap[path] ?? null,
      status: record.status ?? null,
      invoice_id: record.id ?? null,
      due_date: record.due_date ?? null,
      issued_date: record.issued_date ?? null,
      sent_at: record.sent_at ?? null,
      reminder_sent_at: record.reminder_sent_at ?? null,
      invoice_language: record.invoice_language ?? null,
      cancels_invoice_id: record.cancels_invoice_id ?? null,
      cancelled_at: record.cancelled_at ?? null,
      item_subject: record.item_subject ?? null,
      item_quantity: record.item_quantity ?? null,
      item_unit_price: record.item_unit_price ?? null,
      total_amount: record.total_amount ?? null,
      currency: record.currency ?? 'CHF',
      student_id: record.student_id ?? null,
      student: student ?? null,
      student_name: student
        ? [student.first_name, student.last_name].filter(Boolean).join(' ').trim() || null
        : null,
      course_code: course?.course_code ?? null,
      course_subject: course?.subject ?? null,
      course_level: course?.level ?? null,
      course: course ?? null,
    };
  });

  return jsonResponse({ year, files: result });
}, 'invoice-archive');
