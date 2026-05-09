// ---------------------------------------------------------------------------
// GET /api/sessions/search?q=<query>&limit=50
// Full-text search across user message previews via SQLite FTS5.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/security';
import { getPort } from '@/lib/server-state';
import { searchUserMessages } from '@/lib/usage-db';

function parsePositiveInt(raw: string | null, fallback: number, max: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export async function GET(request: NextRequest) {
  const port = getPort();
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, port);

  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') ?? '').trim();
    const limit = parsePositiveInt(searchParams.get('limit'), 50, 200);

    if (!query) {
      return NextResponse.json(
        { result: true, data: { query: '', limit, hits: [] } },
        { headers: cors },
      );
    }

    const hits = searchUserMessages(query, limit);

    return NextResponse.json(
      { result: true, data: { query, limit, hits } },
      { headers: cors },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { result: false, code: 'SESSION_SEARCH_FAILED', message },
      { status: 500, headers: cors },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, getPort()) });
}
