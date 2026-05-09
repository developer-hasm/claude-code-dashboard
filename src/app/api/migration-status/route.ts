// ---------------------------------------------------------------------------
// GET /api/migration-status — JSONL → SQLite migration progress
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/security';
import { getPort } from '@/lib/server-state';
import { getMigrationProgress } from '@/lib/incremental-scanner';

export async function GET(request: NextRequest) {
  const port = getPort();
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, port);

  try {
    const progress = getMigrationProgress();

    return NextResponse.json({
      result: true,
      data: {
        isComplete: progress.isComplete,
        processed: progress.processed,
        total: progress.total,
      },
    }, { headers: cors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { result: false, code: 'MIGRATION_STATUS_FAILED', message },
      { status: 500, headers: cors },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, getPort()) });
}
