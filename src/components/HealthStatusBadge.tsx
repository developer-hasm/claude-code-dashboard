'use client';

import { HealthStatus } from '@/lib/types';

const STATUS_CONFIG: Record<
  HealthStatus,
  { color: string; label: string; defaultHidden: boolean }
> = {
  [HealthStatus.HEALTHY]: { color: 'var(--health-ok)', label: 'Healthy', defaultHidden: true },
  [HealthStatus.WARNING]: { color: 'var(--health-warn)', label: 'Warning', defaultHidden: false },
  [HealthStatus.ERROR]: { color: 'var(--health-error)', label: 'Error', defaultHidden: false },
  [HealthStatus.UNKNOWN]: { color: 'var(--health-unknown)', label: 'Unknown', defaultHidden: false },
};

export interface HealthStatusBadgeProps {
  status: HealthStatus;
  details?: string[];
}

export default function HealthStatusBadge({ status, details }: HealthStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <span
      className="relative inline-flex items-center group"
      aria-label={`Health: ${cfg.label}`}
      style={cfg.defaultHidden ? { opacity: 0, transition: 'opacity 150ms ease' } : undefined}
      onMouseEnter={(e) => {
        if (cfg.defaultHidden) (e.currentTarget as HTMLElement).style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        if (cfg.defaultHidden) (e.currentTarget as HTMLElement).style.opacity = '0';
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        {status === HealthStatus.HEALTHY && (
          <g>
            <circle cx="7" cy="7" r="6" stroke={cfg.color} strokeWidth="1.5" fill="none" />
            <path d="M4 7l2 2 4-4" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {status === HealthStatus.WARNING && (
          <g>
            <path d="M7 1.5L13 12H1L7 1.5z" stroke={cfg.color} strokeWidth="1.3" fill="none" strokeLinejoin="round" />
            <line x1="7" y1="5.5" x2="7" y2="8.5" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7" cy="10.2" r="0.7" fill={cfg.color} />
          </g>
        )}
        {status === HealthStatus.ERROR && (
          <g>
            <circle cx="7" cy="7" r="6" stroke={cfg.color} strokeWidth="1.5" fill="none" />
            <line x1="4.5" y1="4.5" x2="9.5" y2="9.5" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9.5" y1="4.5" x2="4.5" y2="9.5" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" />
          </g>
        )}
        {status === HealthStatus.UNKNOWN && (
          <g>
            <circle cx="7" cy="7" r="6" stroke={cfg.color} strokeWidth="1.5" fill="none" />
            <text x="7" y="10" textAnchor="middle" fontSize="8" fontWeight="600" fill={cfg.color}>?</text>
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {details && details.length > 0 && (
        <span
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 whitespace-pre-line rounded px-2 py-1 text-xs group-hover:block"
          style={{
            background: 'var(--text-primary)',
            color: 'var(--surface)',
            font: '400 12px/1.4 var(--font-sans)',
          }}
        >
          {details.join('\n')}
        </span>
      )}
    </span>
  );
}
