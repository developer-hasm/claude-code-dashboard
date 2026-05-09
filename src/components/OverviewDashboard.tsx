'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { InventorySummary, WeeklyTopItem } from '@/lib/types';
import SummaryCards from './SummaryCards';
import DailyUsageChart from './DailyUsageChart';
import TokenUsageDonut from './TokenUsageDonut';
import WeeklyTop5 from './WeeklyTop5';
import ToolTop5 from './ToolTop5';
import CostBreakdown from './CostBreakdown';
import UnusedItems from './UnusedItems';
import UsageMeter from './UsageMeter';
import WorkspaceRecommendation from './WorkspaceRecommendation';
import RequiredItemsWarning from './RequiredItemsWarning';

export interface OverviewDashboardProps {
  inventory: InventorySummary;
  csrfToken: string;
  onExport?: () => void;
  onImport?: () => void;
}

interface StatsData {
  dailyStats?: { date: string; messageCount: number; sessionCount: number; toolCallCount: number }[];
  dailyCosts?: { date: string; cost: number }[];
  weeklyTop5?: WeeklyTopItem[];
  toolTop5?: { name: string; usageCount: number }[];
}

const SESSION_EFFICIENCY_THRESHOLD = 70;

function computeSessionEfficiency(inventory: InventorySummary): number | null {
  const sessionItems = inventory.items.filter((i) => i.category === 'session');
  if (sessionItems.length === 0) return null;
  const efficiencyValues = sessionItems
    .map((i) => {
      const val = i.metadata.efficiency;
      return val ? parseFloat(val) : NaN;
    })
    .filter((v) => !isNaN(v));
  if (efficiencyValues.length === 0) return null;
  return efficiencyValues.reduce((a, b) => a + b, 0) / efficiencyValues.length;
}

export default function OverviewDashboard({
  inventory,
  csrfToken,
  onExport,
  onImport,
}: OverviewDashboardProps) {
  const { t } = useI18n();

  // Single stats fetch shared by DailyUsageChart, TokenUsageDonut, WeeklyTop5
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/stats');
        const json = await res.json();
        if (!cancelled && json.data) {
          setStats(json.data as StatsData);
        }
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const efficiency = computeSessionEfficiency(inventory);
  const showEfficiencyAlert = efficiency !== null && efficiency < SESSION_EFFICIENCY_THRESHOLD;
  const hasProjectContext = inventory.projectPath !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Title + Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('overview.title')}
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: t('button.export'), handler: onExport },
            { label: t('button.import'), handler: onImport },
          ].map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.handler}
              className="shadow-ring"
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-elevated)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 1. Session Efficiency Alert ── */}
      {showEfficiencyAlert && (
        <div
          role="alert"
          style={{
            background: 'var(--warn-bg)',
            border: '1px solid var(--warn-border)',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M8 2L14.5 13.5H1.5L8 2z" stroke="var(--warn-text)" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
            <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="var(--warn-text)" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="11.2" r="0.7" fill="var(--warn-text)" />
          </svg>
          <span style={{ fontSize: 13, color: 'var(--warn-text)' }}>
            Session efficiency is below {SESSION_EFFICIENCY_THRESHOLD}% (currently {efficiency?.toFixed(1)}%).
          </span>
        </div>
      )}

      {/* ── 2. Rate Limit Usage ── */}
      <UsageMeter />

      {/* ── 2b. Today's estimated cost ── */}
      {(() => {
        const todayCost = stats?.dailyCosts?.find(d => d.date === new Date().toISOString().slice(0, 10))?.cost ?? 0;
        return todayCost > 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            Today: ~${todayCost.toFixed(2)}
            <span title="Pro/Max 구독자의 실제 청구금액이 아닌 API 환산 추정치입니다" style={{ cursor: 'help', color: 'var(--text-tertiary)' }}>ⓘ</span>
          </div>
        ) : null;
      })()}

      {/* ── 3. Required Items Warning ── */}
      {hasProjectContext && <RequiredItemsWarning inventory={inventory} />}

      {/* ── 4. Daily Activity (full width) ── */}
      <DailyUsageChart data={stats?.dailyStats ?? null} costData={stats?.dailyCosts ?? null} loading={statsLoading} />

      {/* ── 5. Cost Breakdown (4.3) — placed near Daily Activity for cost flow continuity ── */}
      <CostBreakdown />

      {/* ── 6. Rankings (2-column) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <WeeklyTop5 data={stats?.weeklyTop5 ?? null} loading={statsLoading} />
        <ToolTop5 data={stats?.toolTop5 ?? null} loading={statsLoading} />
      </div>

      {/* ── Scan time ── */}
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        {t('overview.scanTime').replace('{time}', new Date(inventory.scannedAt).toLocaleTimeString())}
      </div>
    </div>
  );
}
