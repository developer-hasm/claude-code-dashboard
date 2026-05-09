'use client';

import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface DayStat {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface DailyUsageChartProps {
  data: DayStat[] | null;
  costData?: { date: string; cost: number }[] | null;
  loading: boolean;
}

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return dateStr.slice(5); // fallback: MM-DD
  }
}

type ViewMode = 'count' | 'cost';

export default function DailyUsageChart({ data, costData, loading }: DailyUsageChartProps) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>('count');
  const days = useMemo(() => (data ?? []).slice(-30), [data]);
  const costDays = useMemo(() => {
    if (!costData) return [];
    const map = new Map(costData.map(d => [d.date, d.cost]));
    // Align cost data to the same date range as days
    return days.map(d => ({ date: d.date, cost: map.get(d.date) ?? 0 }));
  }, [costData, days]);

  const maxVal = Math.max(
    1,
    ...days.flatMap((d) => [d.messageCount, d.sessionCount, d.toolCallCount]),
  );
  const maxCost = Math.max(0.01, ...costDays.map(d => d.cost));

  const hasCostData = costDays.some(d => d.cost > 0);

  return (
    <div
      className="shadow-ring"
      style={{ background: 'var(--surface)', borderRadius: '8px', padding: '20px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          Daily Activity
        </div>
        {hasCostData && (
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {([
              { mode: 'count' as ViewMode, label: 'Activity' },
              { mode: 'cost' as ViewMode, label: 'Cost' },
            ]).map(btn => (
              <button
                key={btn.mode}
                type="button"
                onClick={() => setViewMode(btn.mode)}
                style={{
                  padding: '4px 12px',
                  fontSize: 11,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === btn.mode ? 'var(--accent)' : 'var(--surface)',
                  color: viewMode === btn.mode ? '#fff' : 'var(--text-secondary)',
                  transition: 'background 150ms ease, color 150ms ease',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t('misc.loading')}</span>
        </div>
      ) : days.length === 0 ? (
        <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No usage data available</span>
        </div>
      ) : viewMode === 'cost' ? (
        <>
          <div className="bar-chart">
            {costDays.map((day) => (
              <div key={day.date} className="bar-column">
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', justifyContent: 'center', width: '100%', height: '100%' }}>
                  <div className="bar" style={{ height: `${Math.max(4, (day.cost / maxCost) * 160)}px`, background: 'var(--health-ok)', width: 42 }}>
                    <span className="bar-tooltip">${day.cost.toFixed(2)}</span>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center', width: '100%', display: 'block' }}>
                  {formatDateLabel(day.date)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--health-ok)', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Estimated Cost (USD)</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="bar-chart">
            {days.map((day) => (
              <div key={day.date} className="bar-column">
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', justifyContent: 'center', width: '100%', height: '100%' }}>
                  <div className="bar" style={{ height: `${Math.max(4, (day.messageCount / maxVal) * 160)}px`, background: 'var(--chart-bar)', flex: 1, maxWidth: 14 }}>
                    <span className="bar-tooltip">{day.messageCount} messages</span>
                  </div>
                  <div className="bar" style={{ height: `${Math.max(4, (day.sessionCount / maxVal) * 160)}px`, background: 'var(--chart-sessions)', flex: 1, maxWidth: 14 }}>
                    <span className="bar-tooltip">{day.sessionCount} sessions</span>
                  </div>
                  <div className="bar" style={{ height: `${Math.max(4, (day.toolCallCount / maxVal) * 160)}px`, background: 'var(--chart-tools)', flex: 1, maxWidth: 14 }}>
                    <span className="bar-tooltip">{day.toolCallCount} tool calls</span>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center', width: '100%', display: 'block' }}>
                  {formatDateLabel(day.date)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, justifyContent: 'center' }}>
            {[
              { color: 'var(--chart-bar)', label: 'Messages' },
              { color: 'var(--chart-sessions)', label: 'Sessions' },
              { color: 'var(--chart-tools)', label: 'Tool Calls' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
