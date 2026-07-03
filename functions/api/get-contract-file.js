// functions/api/get-contract-file.js
// GET /api/get-contract-file?id=<contract uuid>
//
// Streams the uploaded signed contract from the private `contracts` storage
// bucket to the admin. Requires admin auth.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY

import { supabaseHeaders, requireAdminAuth, errorResponse, withErrorHandling } from './_utils.js';

export const onRequestGet = withErrorHandling(async ({ request, env }) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = env;

  const authErr = await requireAdminAuth(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorResponse('Missing id parameter', 400);

  const H = supabaseHeaders(SUPABASE_SERVICE_KEY);
  const conRes = await fetch(
    `${SUPABASE_URL}/rest/v1/contracts?id=eq.${encodeURIComponent(id)}&select=contract_ref,signed_file_path,signed_file_name,signed_content_type`,
    { headers: H }
  );
  if (!conRes.ok) return errorResponse('Database error');
  const contracts = await conRes.json();
  const contract = contracts[0];
  if (!contract) return errorResponse('Contract not found', 404);
  if (!contract.signed_file_path) return errorResponse('No signed contract uploaded yet', 404);

  const fileRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/contracts/${contract.signed_file_path}`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
    }
  );
  if (!fileRes.ok) {
    console.error('Contract file fetch failed:', await fileRes.text());
    return errorResponse('Could not load file', 502);
  }

  // Sanitise for the Content-Disposition header (quotes/control chars break it)
  const safeName = String(
    contract.signed_file_name || `signed-contract-${contract.contract_ref}`
  ).replace(/[^\w.\- ]/g, '_');

  return new Response(fileRes.body, {
    status: 200,
    headers: {
      'Content-Type': contract.signed_content_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'no-store',
    },
  });
}, 'get-contract-file');
