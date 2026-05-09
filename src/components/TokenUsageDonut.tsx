'use client';

import { useMemo, useState } from 'react';

interface TokenSlice {
  name: string;
  tokenCount: number;
  percentage: number;
  color: string;
}

const SLICE_COLORS = [
  'var(--chart-bar)',
  'var(--chart-sessions)',
  'var(--chart-tools)',
  'var(--cat-hook-text)',
  'var(--cat-config-text)',
  'var(--cat-command-text)',
  'var(--cat-session-text)',
  'var(--text-tertiary)',
];

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export interface TokenUsageDonutProps {
  data: { name: string; tokenCount: number; percentage: number }[] | null;
  loading: boolean;
}

export default function TokenUsageDonut({ data, loading }: TokenUsageDonutProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { slices, total } = useMemo(() => {
    if (!data || data.length === 0) return { slices: [] as TokenSlice[], total: 0 };
    const totalTokens = data.reduce((sum, r) => sum + r.tokenCount, 0);

    let items = [...data].sort((a, b) => b.tokenCount - a.tokenCount);
    if (items.length > 8) {
      const top = items.slice(0, 7);
      const rest = items.slice(7);
      const restTotal = rest.reduce((s, r) => s + r.tokenCount, 0);
      const restPct = totalTokens > 0 ? (restTotal / totalTokens) * 100 : 0;
      items = [...top, { name: 'Others', tokenCount: restTotal, percentage: restPct }];
    }

    return {
      slices: items.map((item, i) => ({ ...item, color: SLICE_COLORS[i % SLICE_COLORS.length] })),
      total: totalTokens,
    };
  }, [data]);

  const gradientSegments: string[] = [];
  let currentDeg = 0;
  for (const slice of slices) {
    const deg = (slice.percentage / 100) * 360;
    gradientSegments.push(`${slice.color} ${currentDeg}deg ${currentDeg + deg}deg`);
    currentDeg += deg;
  }
  if (currentDeg < 360) {
    gradientSegments.push(`var(--border-strong) ${currentDeg}deg 360deg`);
  }
  const conicGradient =
    slices.length > 0
      ? `conic-gradient(${gradientSegments.join(', ')})`
      : 'conic-gradient(var(--border-strong) 0deg 360deg)';

  return (
    <div
      className="shadow-ring"
      style={{ background: 'var(--surface)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, alignSelf: 'flex-start' }}>
        Token Usage
      </div>

      {loading ? (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading...</span>
        </div>
      ) : (
        <>
          <div style={{ position: 'relative', width: 200, height: 200 }}>
            <div
              style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: conicGradient,
                transform: hoveredIdx !== null ? 'scale(1.02)' : 'scale(1)',
                transition: 'transform 150ms ease',
              }}
            />
            <div
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 120, height: 120, borderRadius: '50%', background: 'var(--surface)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.2' }}>
                {total > 0 ? formatTokenCount(total) : '--'}
              </span>
              <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>tokens</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16, width: '100%' }}>
            {slices.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>No usage data</span>
            ) : (
              slices.map((slice, idx) => (
                <div
                  key={slice.name}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'default', padding: '2px 0' }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: slice.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {slice.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {slice.percentage.toFixed(1)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
