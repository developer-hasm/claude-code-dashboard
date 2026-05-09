// ---------------------------------------------------------------------------
// POST /api/import/preview — Preview what an import profile would change
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { withAuth, errorResponse, successResponse, handleOptions } from '../../_helpers';
import { validateProfile, previewImport } from '@/lib/exporter';
import { scanAll } from '@/lib/scanner';
import { detectContext } from '@/lib/context';
import type { ExportProfile } from '@/lib/types';

const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5 MB

// ── OPTIONS ──────────────────────────────────────────────────────────────

export function OPTIONS() {
  return handleOptions();
}

// ── POST ─────────────────────────────────────────────────────────────────

export const POST = withAuth(async (request: Request): Promise<NextResponse> => {
  try {
    // Check content-length before parsing
    const contentLength = request.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_BODY_SIZE) {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', 'Profile exceeds maximum size of 5 MB');
    }

    const body = await request.json() as ExportProfile;

    // Validate profile structure
    const validation = validateProfile(body);
    if (!validation.valid) {
      return errorResponse(400, 'INVALID_PROFILE', validation.errors.join('; '));
    }

    // Get current inventory for conflict detection
    const ctx = detectContext();
    const inventory = await scanAll(ctx.projectPath, ctx.globalPath);

    const preview = await previewImport(body, inventory.items);
    return successResponse(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'IMPORT_PREVIEW_FAILED', message);
  }
});
