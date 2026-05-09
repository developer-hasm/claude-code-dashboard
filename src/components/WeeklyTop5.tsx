'use client';

import { useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import type { WeeklyTopItem } from '@/lib/types';

export interface WeeklyTop5Props {
  data: WeeklyTopItem[] | null;
  loading: boolean;
}

const RANK_EMOJI = ['👑', '🥈', '🥉'];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, width: 22, textAlign: 'center' }}>
        {RANK_EMOJI[rank - 1]}
      </span>
    );
  }
  return (
    <span
      style={{
        width: 22,
        height: 22,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--text-tertiary)',
        flexShrink: 0,
      }}
    >
      {rank}
    </span>
  );
}

function CategoryTag({ category }: { category: string }) {
  const key = category === 'mcp_server' ? 'mcp' : category;
  return (
    <span
      style={{
        padding: '1px 6px',
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 600,
        background: `var(--cat-${key}-bg, var(--bg))`,
        color: `var(--cat-${key}-text, var(--text-secondary))`,
        textTransform: 'uppercase',
        letterSpacing: '0.3px',
      }}
    >
      {category}
    </span>
  );
}

export default function WeeklyTop5({ data, loading }: WeeklyTop5Props) {
  const { t } = useI18n();
  const items = useMemo(() => (data ?? []).slice(0, 5), [data]);
  const maxUsage = Math.max(1, ...items.map((i) => i.usageCount));

  return (
    <div
      className="shadow-ring"
      style={{ background: 'var(--surface)', borderRadius: 8, padding: 20 }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
        {t('weekly.title')}
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
            const isTop3 = rank <= 3;

            return (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: isTop3 ? '8px 10px' : '6px 10px',
                  borderRadius: 8,
                  background: isTop3 ? 'var(--bg)' : 'transparent',
                  transition: 'background 150ms ease',
                }}
              >
                {/* Rank */}
                <RankBadge rank={rank} />

                {/* Name + Category + Bar */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: isTop3 ? 14 : 13,
                        fontWeight: isTop3 ? 600 : 500,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
                    </span>
                    <CategoryTag category={item.category} />
                  </div>
                  <div className="top5-bar-bg" style={{ height: isTop3 ? 6 : 4 }}>
                    <div
                      className="top5-bar-fill"
                      style={{
                        width: `${barPct}%`,
                        background: rank === 1
                          ? 'linear-gradient(90deg, #FFD700, #FFA500)'
                          : rank === 2
                            ? 'linear-gradient(90deg, #C0C0C0, #A0A0A0)'
                            : rank === 3
                              ? 'linear-gradient(90deg, #CD7F32, #A0522D)'
                              : 'var(--accent)',
                        height: isTop3 ? 6 : 4,
                      }}
                    />
                  </div>
                </div>

                {/* Count */}
                <span
                  style={{
                    fontSize: isTop3 ? 14 : 12,
                    fontWeight: 600,
                    color: rank === 1 ? '#B8860B' : rank === 2 ? '#808080' : rank === 3 ? '#8B4513' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                    minWidth: 36,
                    textAlign: 'right',
                  }}
                >
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
