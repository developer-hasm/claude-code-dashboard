// ---------------------------------------------------------------------------
// GET/POST /api/bisect — Binary-search debugging for extensions
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { withAuth, withCors, errorResponse, successResponse, handleOptions } from '../_helpers';
import { startBisect, processFeedback, abortBisect, getBisectSession } from '@/lib/bisect';
import { scanAll } from '@/lib/scanner';
import { detectContext } from '@/lib/context';
import path from 'node:path';

// ── OPTIONS ──────────────────────────────────────────────────────────────

export function OPTIONS() {
  return handleOptions();
}

// ── GET — Current bisect session state ───────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getBisectSession();
    if (!session) {
      return errorResponse(404, 'BISECT_NO_SESSION', 'No active bisect session');
    }
    return withCors(
      NextResponse.json({
        result: true,
        data: {
          session,
          currentRound: session.rounds[session.rounds.length - 1] ?? null,
          message: `Bisect session ${session.status}`,
        },
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'BISECT_GET_FAILED', message);
  }
}

// ── POST — Bisect actions (auth required) ────────────────────────────────

export const POST = withAuth(async (request: Request): Promise<NextResponse> => {
  try {
    const body = await request.json() as {
      action: 'start' | 'feedback' | 'abort';
      reproduced?: boolean;
    };

    const { action } = body;

    if (!action || !['start', 'feedback', 'abort'].includes(action)) {
      return errorResponse(400, 'BISECT_INVALID_STATE', 'action must be "start", "feedback", or "abort"');
    }

    switch (action) {
      case 'start': {
        const ctx = detectContext();
        const inventory = await scanAll(ctx.projectPath, ctx.globalPath);
        const settingsPath = ctx.projectPath
          ? path.join(ctx.projectPath, '.claude', 'settings.json')
          : path.join(ctx.globalPath, 'settings.json');

        try {
          const result = await startBisect(inventory.items, settingsPath);
          return successResponse(result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('already in progress')) {
            return errorResponse(409, 'BISECT_SESSION_EXISTS', msg);
          }
          throw err;
        }
      }

      case 'feedback': {
        if (typeof body.reproduced !== 'boolean') {
          return errorResponse(400, 'BISECT_INVALID_STATE', 'reproduced (boolean) is required for feedback action');
        }
        try {
          const result = await processFeedback(body.reproduced);
          return successResponse(result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('No bisect session')) {
            return errorResponse(404, 'BISECT_NO_SESSION', msg);
          }
          if (msg.includes('not waiting')) {
            return errorResponse(400, 'BISECT_INVALID_STATE', msg);
          }
          throw err;
        }
      }

      case 'abort': {
        try {
          const result = await abortBisect();
          return successResponse(result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('No bisect session')) {
            return errorResponse(404, 'BISECT_NO_SESSION', msg);
          }
          throw err;
        }
      }

      default:
        return errorResponse(400, 'BISECT_INVALID_STATE', `Unknown action: ${action}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'BISECT_FAILED', message);
  }
});
