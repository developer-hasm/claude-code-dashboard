// ---------------------------------------------------------------------------
// GET /api/health — Liveness probe
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, uptime: Math.floor(process.uptime()) });
}
