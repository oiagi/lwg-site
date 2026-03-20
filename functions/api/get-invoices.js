// functions/api/get-invoices.js
// GET /api/get-invoices?company_id=...&status=...
//
// Returns invoices with optional company and status filters.
// Includes the company name for display.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD

import { supabaseHeaders, requireAdminAuth, jsonResponse, errorResponse } from './_utils.js';

export async function onRequestGet({ request, env }) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url       = new URL(request.url);
  const companyId = url.searchParams.get('company_id');
  const status    = url.searchParams.get('status');

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);

  try {
    let qs = `${SUPABASE_URL}/rest/v1/invoices?order=created_at.desc&select=*`;
    if (companyId) qs += `&company_id=eq.${companyId}`;
    if (status)    qs += `&status=eq.${status}`;

    const res = await fetch(qs, { headers: H });
    if (!res.ok) return errorResponse('Database error');
    const invoices = await res.json();

    // Load company names
    const companyIds = [...new Set(invoices.map(i => i.company_id))];
    const companyMap = {};
    if (companyIds.length) {
      const filter = companyIds.map(id => `id.eq.${id}`).join(',');
      const compRes = await fetch(
        `${SUPABASE_URL}/rest/v1/companies?or=(${filter})&select=id,name`,
        { headers: H }
      );
      if (compRes.ok) {
        const companies = await compRes.json();
        companies.forEach(c => { companyMap[c.id] = c.name; });
      }
    }

    const enriched = invoices.map(inv => ({
      ...inv,
      company_name: companyMap[inv.company_id] || '—',
    }));

    return jsonResponse(enriched);
  } catch (err) {
    console.error('Error:', err);
    return errorResponse('Connection error');
  }
}
