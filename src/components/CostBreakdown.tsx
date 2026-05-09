'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';

type Dimension = 'agent' | 'skill' | 'cwd';

interface CostRow {
  name: string;
  totalCost: number;
  usageCount: number;
}

interface CostResponse {
  result: boolean;
  data?: {
    dimension: Dimension;
    days: number;
    rows: CostRow[];
    totalCost: number;
  };
}

const DAYS = 30;
const LIMIT = 5;
const RANK_EMOJI = ['👑', '🥈', '🥉'];
const BAR_COLORS = [
  'linear-gradient(90deg, #ef4444, #f97316)',
  'linear-gradient(90deg, #f59e0b, #fbbf24)',
  'linear-gradient(90deg, #6d28d9, #8b5cf6)',
  'var(--accent)',
  'var(--accent)',
];

function formatCost(usd: number): string {
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  if (usd >= 10) return `$${usd.toFixed(1)}`;
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(4)}`;
}

function shortenName(name: string, dim: Dimension): string {
  if (dim !== 'cwd') return name;
  // Show only the last path segment for cwd
  const parts = name.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] || name;
}

export default function CostBreakdown() {
  const { t } = useI18n();
  const [dimension, setDimension] = useState<Dimension>('cwd');
  const [data, setData] = useState<CostResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/cost-breakdown?dimension=${dimension}&days=${DAYS}&limit=${LIMIT}`);
        const json = (await res.json()) as CostResponse;
        if (!cancelled && json.data) setData(json.data);
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dimension]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const maxCost = Math.max(0.0001, ...rows.map((r) => r.totalCost));

  const tabs: { id: Dimension; labelKey: string }[] = [
    { id: 'cwd', labelKey: 'cost.byProject' },
    { id: 'agent', labelKey: 'cost.byAgent' },
    { id: 'skill', labelKey: 'cost.bySkill' },
  ];

  return (
    <div
      className="shadow-ring"
      style={{ background: 'var(--surface)', borderRadius: 8, padding: 20 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          {t('cost.title')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {t('cost.window').replace('{days}', String(DAYS))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
        {tabs.map((tab) => {
          const active = dimension === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDimension(tab.id)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                background: 'transparent',
                border: 'none',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
                cursor: 'pointer',
              }}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {loading ? (
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t('misc.loading')}</span>
      ) : rows.length === 0 ? (
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t('cost.noData')}</span>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((row, idx) => {
              const rank = idx + 1;
              const barPct = (row.totalCost / maxCost) * 100;
              const display = shortenName(row.name, dimension);

              return (
                <div
                  key={row.name}
                  title={row.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: rank <= 3 ? 'var(--bg)' : 'transparent',
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      textAlign: 'center',
                      fontSize: rank <= 3 ? 16 : 12,
                      fontWeight: 700,
                      color: 'var(--text-tertiary)',
                      flexShrink: 0,
                    }}
                  >
                    {rank <= 3 ? RANK_EMOJI[rank - 1] : rank}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: rank <= 3 ? 13 : 12,
                        fontWeight: rank <= 3 ? 600 : 500,
                        color: 'var(--text-primary)',
                        fontFamily: dimension === 'cwd' ? 'var(--font-mono)' : 'inherit',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {display}
                    </span>
                    <div style={{ height: rank <= 3 ? 5 : 3, borderRadius: 3, background: 'var(--border-strong)', marginTop: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${barPct}%`,
                          background: BAR_COLORS[idx] ?? 'var(--accent)',
                          borderRadius: 3,
                          transition: 'width 300ms ease',
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      flexShrink: 0,
                      textAlign: 'right',
                      minWidth: 50,
                    }}
                  >
                    <div
                      style={{
                        fontSize: rank <= 3 ? 14 : 12,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {formatCost(row.totalCost)}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {row.usageCount}× turns
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
            {t('cost.totalShown')}: {formatCost(rows.reduce((s, r) => s + r.totalCost, 0))}
          </div>
        </>
      )}
    </div>
  );
}
