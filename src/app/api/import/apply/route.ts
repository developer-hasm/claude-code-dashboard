// ---------------------------------------------------------------------------
// POST /api/import/apply — Apply an import profile
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { withAuth, errorResponse, successResponse, handleOptions } from '../../_helpers';
import { validateProfile, applyImport } from '@/lib/exporter';
import { detectContext } from '@/lib/context';
import type { ExportProfile } from '@/lib/types';

// ── OPTIONS ──────────────────────────────────────────────────────────────

export function OPTIONS() {
  return handleOptions();
}

// ── POST ─────────────────────────────────────────────────────────────────

export const POST = withAuth(async (request: Request): Promise<NextResponse> => {
  try {
    const body = await request.json() as {
      profile: ExportProfile;
      mode: 'merge' | 'overwrite' | 'clean';
      resolutions: Record<string, 'skip' | 'overwrite'>;
    };

    // Validate required fields
    if (!body.profile) {
      return errorResponse(400, 'MISSING_PROFILE', 'profile is required');
    }
    if (!body.mode || !['merge', 'overwrite', 'clean'].includes(body.mode)) {
      return errorResponse(400, 'INVALID_MODE', 'mode must be "merge", "overwrite", or "clean"');
    }

    // Validate profile structure
    const validation = validateProfile(body.profile);
    if (!validation.valid) {
      return errorResponse(400, 'INVALID_PROFILE', validation.errors.join('; '));
    }

    const ctx = detectContext();
    const result = await applyImport(
      body.profile,
      body.mode,
      body.resolutions ?? {},
      { projectPath: ctx.projectPath, globalPath: ctx.globalPath },
    );

    return successResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'IMPORT_APPLY_FAILED', message);
  }
});
