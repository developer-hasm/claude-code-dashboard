// ---------------------------------------------------------------------------
// GET /api/stats — Daily activity from SQLite (v1.1)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/security';
import { getPort, getGlobalPath, getProjectPath } from '@/lib/server-state';
import { scanAll } from '@/lib/scanner';
import { runIncrementalScan } from '@/lib/incremental-scanner';
import {
  getDb,
  getDailyStats,
  getWeeklyTop5,
  getToolTop5,
  getDailyCosts,
} from '@/lib/usage-db';

export async function GET(request: NextRequest) {
  const port = getPort();
  const origin = request.headers.get('origin');
  const cors = corsHeaders(origin, port);

  try {
    const globalPath = getGlobalPath();

    // Check if DB has data
    const db = getDb();
    const hasData = (db.prepare('SELECT COUNT(*) as cnt FROM processed_files').get() as { cnt: number }).cnt > 0;

    if (!hasData) {
      // First run — start scan in background, return empty immediately
      runIncrementalScan(globalPath).catch(() => {});
      return NextResponse.json({
        result: true,
        data: {
          dailyStats: [],
          weeklyTop5: [],
          toolTop5: [],
          dailyCosts: [],
          migrating: true,
        },
      }, { headers: cors });
    }

    // DB has data — run incremental scan in background (don't block response)
    runIncrementalScan(globalPath).catch(() => {});

    // Query aggregated stats from SQLite
    const dailyStatsRaw = getDailyStats(30);
    const weeklyTop5Raw = getWeeklyTop5();
    const toolTop5Raw = getToolTop5();
    const dailyCostsRaw = getDailyCosts(30);

    // Map daily stats to response shape
    const dailyStats = dailyStatsRaw.map(r => ({
      date: r.date,
      messageCount: r.messageCount,
      sessionCount: r.sessionCount,
      toolCallCount: r.turnCount, // turnCount = assistant messages (closest proxy for tool activity)
    }));

    // Weekly top 5 — filter against actual inventory items
    let weeklyTop5: { name: string; category: string; usageCount: number }[] = [];
    try {
      const inventory = await scanAll(getProjectPath(), globalPath);
      const inventoryNames = new Set(inventory.items.map(i => i.name.toLowerCase()));

      const combined = [
        ...weeklyTop5Raw.agents.map(a => ({ name: a.name, category: 'agent', usageCount: a.usageCount })),
        ...weeklyTop5Raw.skills.map(s => ({ name: s.name, category: 'skill', usageCount: s.usageCount })),
      ];

      weeklyTop5 = combined
        .filter(item => inventoryNames.has(item.name.toLowerCase()))
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5);
    } catch { /* inventory scan failed, return empty */ }

    // Tool top 5
    const toolTop5 = toolTop5Raw.map(t => ({
      name: t.toolName,
      usageCount: t.usageCount,
    }));

    // Daily costs
    const dailyCosts = dailyCostsRaw.map(c => ({
      date: c.date,
      cost: c.estimatedCost,
    }));

    return NextResponse.json({
      result: true,
      data: {
        dailyStats,
        weeklyTop5,
        toolTop5,
        dailyCosts,
        migrating: false,
      },
    }, { headers: cors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { result: false, code: 'STATS_FAILED', message },
      { status: 500, headers: cors },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin, getPort()) });
}
