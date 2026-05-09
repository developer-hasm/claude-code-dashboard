'use client';

import { HealthStatus, ItemScope, type InventorySummary } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

export interface SummaryCardsProps {
  inventory: InventorySummary;
}

/** Derive health from metadata convention: metadata.health */
function deriveHealthStatus(meta: Record<string, string>): HealthStatus {
  const h = meta.health?.toUpperCase();
  if (h === 'WARNING' || h === 'WARN') return HealthStatus.WARNING;
  if (h === 'ERROR') return HealthStatus.ERROR;
  return HealthStatus.HEALTHY;
}

const DOT_COLORS: Record<string, string> = {
  total: 'var(--accent)',
  project: 'var(--scope-project-text)',
  global: 'var(--scope-global-text)',
  issues: 'var(--health-error)',
};

export default function SummaryCards({ inventory }: SummaryCardsProps) {
  const { t } = useI18n();

  const projectCount = inventory.items.filter((i) => i.scope === ItemScope.PROJECT).length;
  const globalCount = inventory.items.filter((i) => i.scope === ItemScope.GLOBAL).length;
  const issueCount = inventory.items.filter((i) => {
    const status = deriveHealthStatus(i.metadata);
    return status === HealthStatus.WARNING || status === HealthStatus.ERROR;
  }).length;

  const cards = [
    { key: 'total', label: t('overview.totalItems'), value: inventory.totalCount },
    { key: 'project', label: t('overview.projectScope'), value: projectCount },
    { key: 'global', label: t('overview.globalScope'), value: globalCount },
    { key: 'issues', label: 'Health Issues', value: issueCount },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {cards.map((card) => (
        <div
          key={card.key}
          className="shadow-ring"
          style={{
            background: 'var(--surface)',
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: DOT_COLORS[card.key],
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '1.38' }}>
              {card.label}
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.2' }}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
