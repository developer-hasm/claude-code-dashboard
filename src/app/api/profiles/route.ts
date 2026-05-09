// ---------------------------------------------------------------------------
// GET/POST /api/profiles — Manage settings profiles
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { withAuth, withCors, errorResponse, successResponse, handleOptions } from '../_helpers';
import { listProfiles, saveProfile, switchProfile, deleteProfile } from '@/lib/profile-manager';
import { scanAll } from '@/lib/scanner';
import { detectContext } from '@/lib/context';

// ── OPTIONS ──────────────────────────────────────────────────────────────

export function OPTIONS() {
  return handleOptions();
}

// ── GET — List profiles (no auth required for read) ──────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const profiles = await listProfiles();
    return withCors(
      NextResponse.json({
        result: true,
        data: { profiles, activeProfile: null },
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'PROFILE_LIST_FAILED', message);
  }
}

// ── POST — Profile actions (auth required) ───────────────────────────────

export const POST = withAuth(async (request: Request): Promise<NextResponse> => {
  try {
    const body = await request.json() as {
      action: 'save' | 'switch' | 'delete';
      name: string;
      items?: string[];
    };

    const { action, name } = body;

    if (!action || !['save', 'switch', 'delete'].includes(action)) {
      return errorResponse(400, 'INVALID_ACTION', 'action must be "save", "switch", or "delete"');
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return errorResponse(400, 'INVALID_PROFILE_NAME', 'name is required and must be a non-empty string');
    }

    const ctx = detectContext();

    switch (action) {
      case 'save': {
        const inventory = await scanAll(ctx.projectPath, ctx.globalPath);
        try {
          await saveProfile(name, inventory.items);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('Invalid profile name')) {
            return errorResponse(400, 'INVALID_PROFILE_NAME', msg);
          }
          if (msg.includes('reserved')) {
            return errorResponse(400, 'INVALID_PROFILE_NAME', msg);
          }
          throw err;
        }
        const profiles = await listProfiles();
        return successResponse({
          action: 'save',
          name,
          message: `Profile "${name}" saved successfully`,
          profiles,
        });
      }

      case 'switch': {
        try {
          await switchProfile(name, ctx);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('not found')) {
            return errorResponse(404, 'PROFILE_NOT_FOUND', msg);
          }
          if (msg.includes('Invalid profile name')) {
            return errorResponse(400, 'INVALID_PROFILE_NAME', msg);
          }
          throw err;
        }
        const profiles = await listProfiles();
        return successResponse({
          action: 'switch',
          name,
          message: `Switched to profile "${name}"`,
          profiles,
        });
      }

      case 'delete': {
        try {
          await deleteProfile(name);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('not found')) {
            return errorResponse(404, 'PROFILE_NOT_FOUND', msg);
          }
          if (msg.includes('Invalid profile name')) {
            return errorResponse(400, 'INVALID_PROFILE_NAME', msg);
          }
          throw err;
        }
        const profiles = await listProfiles();
        return successResponse({
          action: 'delete',
          name,
          message: `Profile "${name}" deleted`,
          profiles,
        });
      }

      default:
        return errorResponse(400, 'INVALID_ACTION', `Unknown action: ${action}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'PROFILE_ACTION_FAILED', message);
  }
});
