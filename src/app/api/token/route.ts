// ---------------------------------------------------------------------------
// GET /api/token — Return the server authentication token
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, validateHost } from '@/lib/security';
import { getToken, getPort } from '@/lib/server-state';

export async function GET(request: NextRequest) {
  const port = getPort();
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, port);

  // Host validation — mitigate DNS rebinding
  if (!validateHost(request, port)) {
    return NextResponse.json(
      { result: false, code: 'INVALID_HOST', message: 'Host header validation failed' },
      { status: 403, headers: cors },
    );
  }

  return NextResponse.json(
    { result: true, data: { token: getToken() } },
    { headers: cors },
  );
}

// Preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, getPort()) });
}
