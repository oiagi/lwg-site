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

function currentYear() {
  return new Date().getFullYear();
}

async function listYearFiles(env, year) {
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prefix: `${year}/`,
      limit: 500,
      offset: 0,
      sortBy: { column: 'name', order: 'desc' },
    }),
  });
  if (!res.ok) throw new Error(`Storage list failed: ${await res.text()}`);
  return res.json();
}

// Columns added by later migrations. Databases that have not run them yet fall
// back to the base column set rather than failing the whole archive listing.
const BASE_COLUMNS = 'id,invoice_number,status,total_amount,currency,due_date,student_id,course_id';
const OPTIONAL_COLUMNS = ['reminder_sent_at', 'cancelled_at', 'cancellation_notified_at'];

async function fetchInvoiceRecords(env, invoiceNumbers) {
  if (invoiceNumbers.length === 0) return [];
  const list = invoiceNumbers.map((n) => encodeURIComponent(n)).join(',');
  const url = `${env.SUPABASE_URL}/rest/v1/invoices?invoice_number=in.(${list})`;
  let res = await fetch(`${url}&select=${BASE_COLUMNS},${OPTIONAL_COLUMNS.join(',')}`, {
    headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (!OPTIONAL_COLUMNS.some((col) => errorText.includes(col))) {
      console.error('invoice-archive DB fetch failed:', errorText);
      return [];
    }
    res = await fetch(`${url}&select=${BASE_COLUMNS}`, {
      headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
    });
  }
  if (!res.ok) {
    console.error('invoice-archive DB fetch failed:', await res.text());
    return [];
  }
  return res.json();
}

async function fetchRelatedRecords(env, table, ids, select) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return {};
  const list = uniqueIds.map((id) => encodeURIComponent(id)).join(',');
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?id=in.(${list})&select=${select}`, {
    headers: supabaseHeaders(env.SUPABASE_SERVICE_KEY),
  });
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
  const [studentMap, courseMap] = await Promise.all([
    fetchRelatedRecords(
      env,
      'students',
      records.map((r) => r.student_id),
      'id,first_name,last_name'
    ),
    fetchRelatedRecords(
      env,
      'courses',
      records.map((r) => r.course_id),
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
      reminder_sent_at: record.reminder_sent_at ?? null,
      cancelled_at: record.cancelled_at ?? null,
      cancellation_notified_at: record.cancellation_notified_at ?? null,
      total_amount: record.total_amount ?? null,
      currency: record.currency ?? 'CHF',
      student_name: student
        ? [student.first_name, student.last_name].filter(Boolean).join(' ').trim() || null
        : null,
      course_code: course?.course_code ?? null,
      course_subject: course?.subject ?? null,
      course_level: course?.level ?? null,
    };
  });

  return jsonResponse({ year, files: result });
}, 'invoice-archive');
