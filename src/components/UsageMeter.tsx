'use client';

import { useEffect, useState } from 'react';

interface UsageWindowData {
  utilization: number;
  resetsAt: string;
  percentUsed: number;
}

interface UsageApiData {
  fiveHour: UsageWindowData;
  sevenDay: UsageWindowData;
  sevenDayOpus: { utilization: number; percentUsed: number } | null;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function formatTimeRemaining(resetsAt: string): string {
  const diff = new Date(resetsAt).getTime() - Date.now();
  if (diff <= 0) return 'resetting...';
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

function BarSegment({ label, pct, resetsAt }: { label: string; pct: number; resetsAt?: string }) {
  const color = pct >= 80 ? 'var(--danger)' : pct >= 50 ? 'var(--health-warn)' : 'var(--health-ok)';
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{pct}%</span>
      </div>
      <div style={{
        height: 8, borderRadius: 4, background: 'var(--border-strong)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color, borderRadius: 4,
          transition: 'width 300ms ease',
        }} />
      </div>
      {resetsAt && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
          Reset: {formatTime(resetsAt)} ({formatTimeRemaining(resetsAt)})
        </div>
      )}
    </div>
  );
}

export default function UsageMeter() {
  const [data, setData] = useState<UsageApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchUsage = async () => {
      try {
        const res = await fetch('/api/usage');
        const json = await res.json();
        if (!cancelled) {
          if (json.result && json.data) {
            setData(json.data);
            setError(null);
          } else {
            setError(json.message || null);
          }
        }
      } catch {
        if (!cancelled) setError('Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUsage();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchUsage, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (loading) return null;
  if (error || !data) {
    return (
      <div
        className="shadow-ring"
        style={{
          background: 'var(--surface)', borderRadius: 8, padding: '12px 18px',
          fontSize: 12, color: 'var(--text-tertiary)',
        }}
      >
        Rate limit: {error || 'OAuth credentials not found'}
      </div>
    );
  }

  return (
    <div
      className="shadow-ring"
      style={{
        background: 'var(--surface)',
        borderRadius: 8,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        Rate Limit
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        <BarSegment
          label="5h Window"
          pct={data.fiveHour.percentUsed}
          resetsAt={data.fiveHour.resetsAt}
        />
        <BarSegment
          label="7d Window"
          pct={data.sevenDay.percentUsed}
          resetsAt={data.sevenDay.resetsAt}
        />
        {data.sevenDayOpus && (
          <BarSegment
            label="7d Opus"
            pct={data.sevenDayOpus.percentUsed}
          />
        )}
      </div>
    </div>
  );
}
