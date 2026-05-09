// ---------------------------------------------------------------------------
// GET /api/usage — Real-time rate limit from Anthropic OAuth API
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/security';
import { getPort } from '@/lib/server-state';
import { getClaudeUsage, isOAuthAvailable } from '@/lib/claude-oauth';

export async function GET(request: NextRequest) {
  const port = getPort();
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, port);

  try {
    const available = await isOAuthAvailable();
    if (!available) {
      return NextResponse.json({
        result: true,
        data: null,
        message: 'OAuth credentials not found',
      }, { headers: cors });
    }

    const usage = await getClaudeUsage();
    if (!usage) {
      return NextResponse.json({
        result: true,
        data: null,
        message: 'Failed to fetch usage data',
      }, { headers: cors });
    }

    return NextResponse.json({
      result: true,
      data: {
        fiveHour: {
          utilization: usage.five_hour.utilization,
          resetsAt: usage.five_hour.resets_at,
          // utilization can be 0-1 (ratio) or 0-100 (percent) depending on API version
          percentUsed: Math.round(usage.five_hour.utilization > 1 ? usage.five_hour.utilization : usage.five_hour.utilization * 100),
        },
        sevenDay: {
          utilization: usage.seven_day.utilization,
          resetsAt: usage.seven_day.resets_at,
          percentUsed: Math.round(usage.seven_day.utilization > 1 ? usage.seven_day.utilization : usage.seven_day.utilization * 100),
        },
        sevenDayOpus: usage.seven_day_opus ? {
          utilization: usage.seven_day_opus.utilization,
          percentUsed: Math.round(usage.seven_day_opus.utilization > 1 ? usage.seven_day_opus.utilization : usage.seven_day_opus.utilization * 100),
        } : null,
      },
    }, { headers: cors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { result: false, code: 'USAGE_FAILED', message },
      { status: 500, headers: cors },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, getPort()) });
}
