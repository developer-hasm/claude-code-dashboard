// ---------------------------------------------------------------------------
// POST /api/export — Export dashboard items as a profile
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { withAuth, withCors, errorResponse, successResponse, handleOptions } from '../_helpers';
import { exportAll, exportSelected } from '@/lib/exporter';
import { scanAll } from '@/lib/scanner';
import { detectContext } from '@/lib/context';

// ── OPTIONS ──────────────────────────────────────────────────────────────

export function OPTIONS() {
  return handleOptions();
}

// ── POST ─────────────────────────────────────────────────────────────────

export const POST = withAuth(async (request: Request): Promise<NextResponse> => {
  try {
    const body = await request.json() as {
      mode: 'all' | 'selected';
      itemIds?: string[];
      includeLocalSettings?: boolean;
    };

    if (!body.mode || !['all', 'selected'].includes(body.mode)) {
      return errorResponse(400, 'INVALID_MODE', 'mode must be "all" or "selected"');
    }

    if (body.mode === 'selected' && (!Array.isArray(body.itemIds) || body.itemIds.length === 0)) {
      return errorResponse(400, 'MISSING_ITEM_IDS', 'itemIds is required for "selected" mode');
    }

    const ctx = detectContext();
    const inventory = await scanAll(ctx.projectPath, ctx.globalPath);
    const includeLocalSettings = body.includeLocalSettings ?? false;

    let profile;
    if (body.mode === 'all') {
      profile = await exportAll(inventory.items, { includeLocalSettings });
    } else {
      profile = await exportSelected(inventory.items, body.itemIds!, { includeLocalSettings });
    }

    return successResponse(profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'EXPORT_FAILED', message);
  }
});
