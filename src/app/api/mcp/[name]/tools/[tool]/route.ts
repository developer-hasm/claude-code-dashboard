// ---------------------------------------------------------------------------
// PATCH /api/mcp/[name]/tools/[tool] — Toggle individual MCP tool
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { withAuth, errorResponse, successResponse, handleOptions } from '../../../../_helpers';
import { detectContext } from '@/lib/context';
import { safeModifySettings } from '@/lib/settings-mutex';
import fs from 'node:fs/promises';
import path from 'node:path';

interface RouteParams {
  params: Promise<{ name: string; tool: string }>;
}

// ── OPTIONS ──────────────────────────────────────────────────────────────

export function OPTIONS() {
  return handleOptions();
}

// ── PATCH — Toggle a single MCP tool ─────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  // Auth check inline since Next.js dynamic routes need the params signature
  const token = process.env.DASHBOARD_TOKEN;
  if (!token) {
    return errorResponse(500, 'SERVER_ERROR', 'Server token not configured');
  }

  const { validateToken } = await import('@/lib/security');
  if (!validateToken(request, token)) {
    return errorResponse(401, 'UNAUTHORIZED', 'Invalid or missing authentication token');
  }

  try {
    const { name: serverName, tool: toolName } = await params;
    const body = await request.json() as { enabled: boolean };

    if (typeof body.enabled !== 'boolean') {
      return errorResponse(400, 'INVALID_BODY', 'enabled (boolean) is required');
    }

    const ctx = detectContext();

    // Determine settings file — prefer project-level, fall back to global
    const settingsPath = ctx.projectPath
      ? path.join(ctx.projectPath, '.claude', 'settings.json')
      : path.join(ctx.globalPath, 'settings.json');

    // Verify settings file exists
    try {
      await fs.access(settingsPath);
    } catch {
      return errorResponse(404, 'SETTINGS_NOT_FOUND', `Settings file not found at ${settingsPath}`);
    }

    // Validate and apply the toggle in a single read inside safeModifySettings
    let serverNotFound = false;
    await safeModifySettings<Record<string, unknown>>(settingsPath, (data) => {
      const servers = (data.mcpServers ?? {}) as Record<string, Record<string, unknown>>;
      const config = servers[serverName];
      if (!config) {
        serverNotFound = true;
        return data;
      }

      let disabledTools = (config.disabledTools ?? []) as string[];

      if (body.enabled) {
        // Remove tool from disabled list
        disabledTools = disabledTools.filter((t: string) => t !== toolName);
      } else {
        // Add tool to disabled list (if not already there)
        if (!disabledTools.includes(toolName)) {
          disabledTools.push(toolName);
        }
      }

      config.disabledTools = disabledTools;
      servers[serverName] = config;
      data.mcpServers = servers;
      return data;
    });

    if (serverNotFound) {
      return errorResponse(404, 'MCP_SERVER_NOT_FOUND', `MCP server "${serverName}" not found in settings`);
    }

    return successResponse({
      serverName,
      toolName,
      enabled: body.enabled,
      settingsModified: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, 'MCP_TOOL_TOGGLE_FAILED', message);
  }
}
