// ---------------------------------------------------------------------------
// GET /api/cost-breakdown?dimension=agent|skill|cwd&days=30&limit=10
// Returns top-N entries by total cost for the given dimension.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/security';
import { getPort } from '@/lib/server-state';
import { getCostBreakdown, type CostDimension } from '@/lib/usage-db';

const VALID_DIMENSIONS: readonly CostDimension[] = ['agent', 'skill', 'cwd'];

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
    const dimensionRaw = searchParams.get('dimension');

    if (!dimensionRaw || !VALID_DIMENSIONS.includes(dimensionRaw as CostDimension)) {
      return NextResponse.json(
        {
          result: false,
          code: 'INVALID_DIMENSION',
          message: `dimension must be one of: ${VALID_DIMENSIONS.join(', ')}`,
        },
        { status: 400, headers: cors },
      );
    }

    const dimension = dimensionRaw as CostDimension;
    const days = parsePositiveInt(searchParams.get('days'), 30, 365);
    const limit = parsePositiveInt(searchParams.get('limit'), 10, 100);

    const rows = getCostBreakdown(dimension, days, limit);

    return NextResponse.json(
      {
        result: true,
        data: {
          dimension,
          days,
          limit,
          rows,
          totalCost: rows.reduce((sum, r) => sum + (r.totalCost ?? 0), 0),
        },
      },
      { headers: cors },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { result: false, code: 'COST_BREAKDOWN_FAILED', message },
      { status: 500, headers: cors },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, getPort()) });
}
