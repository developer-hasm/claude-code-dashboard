'use client';

import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';

interface ToolUsageItem {
  name: string;
  usageCount: number;
}

export interface ToolTop5Props {
  data: ToolUsageItem[] | null;
  loading: boolean;
}

const RANK_EMOJI = ['👑', '🥈', '🥉'];

const BAR_COLORS = [
  'linear-gradient(90deg, #6d28d9, #8b5cf6)',
  'linear-gradient(90deg, #0a72ef, #3b82f6)',
  'linear-gradient(90deg, #16a34a, #4ade80)',
  'var(--accent)',
  'var(--accent)',
];

export default function ToolTop5({ data, loading }: ToolTop5Props) {
  const { t } = useI18n();
  const items = useMemo(() => (data ?? []).slice(0, 5), [data]);
  const maxUsage = Math.max(1, ...items.map((i) => i.usageCount));

  return (
    <div
      className="shadow-ring"
      style={{ background: 'var(--surface)', borderRadius: 8, padding: 20 }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
        {t('toolTop5.title')}
      </div>

      {loading ? (
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t('misc.loading')}</span>
      ) : items.length === 0 ? (
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Not enough data yet</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, idx) => {
            const rank = idx + 1;
            const barPct = (item.usageCount / maxUsage) * 100;

            return (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: rank <= 3 ? 'var(--bg)' : 'transparent',
                }}
              >
                {/* Rank */}
                <span style={{ width: 22, textAlign: 'center', fontSize: rank <= 3 ? 16 : 12, fontWeight: 700, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  {rank <= 3 ? RANK_EMOJI[rank - 1] : rank}
                </span>

                {/* Name + bar */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: rank <= 3 ? 14 : 13,
                    fontWeight: rank <= 3 ? 600 : 500,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {item.name}
                  </span>
                  <div style={{ height: rank <= 3 ? 5 : 3, borderRadius: 3, background: 'var(--border-strong)', marginTop: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${barPct}%`,
                      background: BAR_COLORS[idx] ?? 'var(--accent)',
                      borderRadius: 3,
                      transition: 'width 300ms ease',
                    }} />
                  </div>
                </div>

                {/* Count */}
                <span style={{
                  fontSize: rank <= 3 ? 14 : 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                  minWidth: 36,
                  textAlign: 'right',
                }}>
                  {item.usageCount}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
