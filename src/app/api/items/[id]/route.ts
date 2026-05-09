// ---------------------------------------------------------------------------
// DELETE /api/items/:id — Delete a single dashboard item
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, validateToken, createRateLimiter } from '@/lib/security';
import { getToken, getPort, getProjectPath, getGlobalPath } from '@/lib/server-state';
import { scanAll } from '@/lib/scanner';
import { deleteItem } from '@/lib/deleter';

// Rate-limit destructive operations: max 10 deletes per 60 s
const deleteLimiter = createRateLimiter(10, 60_000);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const port = getPort();
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, port);

  try {
    // 1. Authenticate (timing-safe comparison via validateToken)
    const serverToken = getToken();
    const authenticated = validateToken(request, serverToken);

    if (!authenticated) {
      return NextResponse.json(
        { result: false, code: 'UNAUTHORIZED', message: 'Invalid or missing token' },
        { status: 401, headers: cors },
      );
    }

    // 2. Rate-limit check
    if (!deleteLimiter.check()) {
      return NextResponse.json(
        { result: false, code: 'RATE_LIMITED', message: 'Too many delete requests. Try again later.' },
        { status: 429, headers: cors },
      );
    }

    // 3. Decode the item ID from the URL
    const { id: rawId } = await params;
    const itemId = decodeURIComponent(rawId);

    // 4. Find the item in the current inventory
    const projectPath = getProjectPath();
    const globalPath = getGlobalPath();
    const inventory = await scanAll(projectPath, globalPath);
    const item = inventory.items.find((i) => i.id === itemId);

    if (!item) {
      return NextResponse.json(
        { result: false, code: 'ITEM_NOT_FOUND', message: `Item "${itemId}" not found` },
        { status: 404, headers: cors },
      );
    }

    // 5. Build allowed-prefix list for path validation
    const allowedPrefixes: string[] = [globalPath];
    if (projectPath) {
      allowedPrefixes.push(projectPath);
    }

    // 6. Perform the deletion
    const result = await deleteItem(item, allowedPrefixes, () =>
      scanAll(projectPath, globalPath),
    );

    return NextResponse.json({ result: true, data: result }, { headers: cors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Map known error messages to appropriate codes
    if (message.includes('modified')) {
      return NextResponse.json(
        { result: false, code: 'ITEM_MODIFIED', message },
        { status: 409, headers: cors },
      );
    }

    return NextResponse.json(
      { result: false, code: 'DELETE_FAILED', message },
      { status: 500, headers: cors },
    );
  }
}

// Preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, getPort()) });
}
