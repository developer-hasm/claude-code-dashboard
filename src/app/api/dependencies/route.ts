// ---------------------------------------------------------------------------
// GET /api/dependencies — Build and return the dependency graph
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/security';
import { getPort, getProjectPath, getGlobalPath } from '@/lib/server-state';
import { scanAll } from '@/lib/scanner';
import { buildDependencyGraph } from '@/lib/dependency-graph';
import type { DependencyGraphResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  const port = getPort();
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, port);

  try {
    const projectPath = getProjectPath();
    const globalPath = getGlobalPath();
    const inventory = await scanAll(projectPath, globalPath);

    const graph = await buildDependencyGraph(inventory.items);

    const response: DependencyGraphResponse = {
      nodes: graph.nodes,
      edges: graph.edges,
      circularRefs: graph.circularRefs,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ result: true, data: response }, { headers: cors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { result: false, code: 'GRAPH_FAILED', message },
      { status: 500, headers: cors },
    );
  }
}

// Preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, getPort()) });
}
