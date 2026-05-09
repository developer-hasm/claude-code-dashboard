// ---------------------------------------------------------------------------
// GET /api/inventory — Scan and return all dashboard items
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/security';
import { getPort, getProjectPath, getGlobalPath } from '@/lib/server-state';
import { scanAll } from '@/lib/scanner';
import { ItemCategory, ItemScope } from '@/lib/types';

export async function GET(request: NextRequest) {
  const port = getPort();
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, port);

  try {
    const projectPath = getProjectPath();
    const globalPath = getGlobalPath();
    let summary = await scanAll(projectPath, globalPath);

    // Optional query-param filters
    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get('category');
    const scopeFilter = searchParams.get('scope');

    if (categoryFilter || scopeFilter) {
      let filtered = summary.items;

      if (categoryFilter) {
        const validCategory = Object.values(ItemCategory).includes(categoryFilter as ItemCategory);
        if (validCategory) {
          filtered = filtered.filter((i) => i.category === categoryFilter);
        }
      }

      if (scopeFilter) {
        const validScope = Object.values(ItemScope).includes(scopeFilter as ItemScope);
        if (validScope) {
          filtered = filtered.filter((i) => i.scope === scopeFilter);
        }
      }

      // Rebuild counts for the filtered set
      const counts = {} as Record<ItemCategory, number>;
      for (const cat of Object.values(ItemCategory)) {
        counts[cat] = 0;
      }
      for (const item of filtered) {
        counts[item.category]++;
      }

      summary = {
        ...summary,
        items: filtered,
        totalCount: filtered.length,
        counts,
      };
    }

    return NextResponse.json({ result: true, data: summary }, { headers: cors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { result: false, code: 'SCAN_FAILED', message },
      { status: 500, headers: cors },
    );
  }
}

// Preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, getPort()) });
}
