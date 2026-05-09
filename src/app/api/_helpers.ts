// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — API Route Helpers
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { validateToken } from '@/lib/security';

// ── Environment ──────────────────────────────────────────────────────────

function getServerToken(): string {
  const token = process.env.DASHBOARD_TOKEN;
  if (!token) throw new Error('DASHBOARD_TOKEN not set');
  return token;
}

function getDashboardPort(): number {
  return Number(process.env.DASHBOARD_PORT ?? '3200');
}

// ── CORS ─────────────────────────────────────────────────────────────────

export function withCors(response: NextResponse): NextResponse {
  const port = getDashboardPort();
  response.headers.set('Access-Control-Allow-Origin', `http://localhost:${port}`);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400');
  response.headers.set('Vary', 'Origin');
  return response;
}

// ── Error Response ───────────────────────────────────────────────────────

export function errorResponse(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return withCors(
    NextResponse.json({ result: false, code, message }, { status }),
  );
}

// ── Success Response ─────────────────────────────────────────────────────

export function successResponse<T>(data: T, status = 200): NextResponse {
  return withCors(
    NextResponse.json({ result: true, data }, { status }),
  );
}

// ── Auth Wrapper ─────────────────────────────────────────────────────────

type RouteHandler = (request: Request) => Promise<NextResponse>;

/**
 * Wrap a route handler with token validation.
 * Returns 401 if the token is missing or invalid.
 */
export function withAuth(handler: RouteHandler): RouteHandler {
  return async (request: Request): Promise<NextResponse> => {
    try {
      const serverToken = getServerToken();
      if (!validateToken(request, serverToken)) {
        return errorResponse(401, 'UNAUTHORIZED', 'Invalid or missing authentication token');
      }
      return await handler(request);
    } catch (err) {
      if (err instanceof Error && err.message === 'DASHBOARD_TOKEN not set') {
        return errorResponse(500, 'SERVER_ERROR', 'Server token not configured');
      }
      throw err;
    }
  };
}

// ── CORS Preflight ───────────────────────────────────────────────────────

export function handleOptions(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}
