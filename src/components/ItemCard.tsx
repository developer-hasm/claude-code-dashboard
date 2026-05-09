'use client';

import { useCallback, useRef, useState } from 'react';
import { DashboardItem, HealthStatus, ItemCategory, ItemScope } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import CategoryBadge from './CategoryBadge';
import ScopeBadge from './ScopeBadge';
import HealthStatusBadge from './HealthStatusBadge';

// ── Helpers ───────────────────────────────────────────────────────────────

/** Categories that are read-only (no delete button). */
const READ_ONLY_CATEGORIES = new Set<ItemCategory>([
  ItemCategory.SESSION,
  ItemCategory.CONFIG,
]);

/** Pick health status from metadata (convention: metadata.health). */
function deriveHealth(item: DashboardItem): HealthStatus {
  const h = item.metadata.health?.toUpperCase();
  if (h === 'HEALTHY' || h === 'OK') return HealthStatus.HEALTHY;
  if (h === 'WARNING' || h === 'WARN') return HealthStatus.WARNING;
  if (h === 'ERROR') return HealthStatus.ERROR;
  return HealthStatus.UNKNOWN;
}

/** Metadata keys worth displaying inline. */
const DISPLAY_META_KEYS = [
  'model',
  'version',
  'transportType',
  'timeout',
  'language',
];

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10); // "2026-03-26"
  } catch {
    return iso;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export interface ItemCardProps {
  item: DashboardItem;
  onDelete: (item: DashboardItem) => void;
  hideCategoryBadge?: boolean;
}

export default function ItemCard({ item, onDelete, hideCategoryBadge }: ItemCardProps) {
  const { t } = useI18n();
  const [showFullDesc, setShowFullDesc] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  const isDisabled = item.metadata.enabled === 'false';
  const isReadOnly = READ_ONLY_CATEGORIES.has(item.category);
  const health = deriveHealth(item);
  const healthDetails = item.metadata.healthDetails
    ? item.metadata.healthDetails.split(';').map((s) => s.trim())
    : undefined;

  const inlineMeta = DISPLAY_META_KEYS
    .filter((k) => item.metadata[k] != null)
    .map((k) => ({ key: k, value: item.metadata[k] }));

  const handleDelete = useCallback(() => {
    onDelete(item);
  }, [item, onDelete]);

  // Determine if description is clamped (heuristic: > 120 chars)
  const descLong = item.description != null && item.description.length > 120;

  return (
    <article
      className={`card shadow-ring${health === HealthStatus.ERROR ? ' shadow-error-inset' : ''}`}
      style={{
        background: 'var(--surface)',
        borderRadius: '8px',
        padding: '16px',
        opacity: 1,
        transition: 'box-shadow 150ms ease',
      }}
    >
      {/* ── Row 1: Name + badges + delete ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: '1.4',
            }}
          >
            {item.name}
          </span>
          {health !== HealthStatus.UNKNOWN && health !== HealthStatus.HEALTHY && item.category !== ItemCategory.MCP_SERVER && (
            <HealthStatusBadge status={health} details={healthDetails} />
          )}
          <ScopeBadge scope={item.scope} />
          {isDisabled && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '9999px',
                font: '500 11px/1.45 var(--font-sans)',
                background: 'var(--border-strong)',
                color: 'var(--text-tertiary)',
              }}
            >
              disabled
            </span>
          )}
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={handleDelete}
            aria-label={`Delete ${item.name}`}
            className="shrink-0 cursor-pointer rounded px-2 py-1"
            style={{
              font: '500 13px/1.38 var(--font-sans)',
              color: 'var(--danger)',
              background: 'var(--danger-subtle)',
              border: 'none',
              borderRadius: '6px',
              transition: 'background 150ms ease, color 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--danger)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--danger-subtle)';
              e.currentTarget.style.color = 'var(--danger)';
            }}
          >
            {t('button.delete')}
          </button>
        )}
      </div>

      {/* ── Row 2: Category + inline metadata ── */}
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {!hideCategoryBadge && <CategoryBadge category={item.category} />}
        {inlineMeta.map(({ key, value }) => (
          <span
            key={key}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: '1.38',
            }}
          >
            {key}={value}
          </span>
        ))}
      </div>

      {/* ── Row 3: Description ── */}
      {item.description != null && (
        <div className="mt-2">
          <p
            ref={descRef}
            className={showFullDesc ? '' : 'line-clamp-2'}
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
              margin: 0,
            }}
          >
            {item.description}
          </p>
          {descLong && (
            <button
              type="button"
              onClick={() => setShowFullDesc((v) => !v)}
              className="mt-1 cursor-pointer border-none bg-transparent p-0"
              style={{
                font: '500 13px/1.38 var(--font-sans)',
                color: 'var(--accent)',
              }}
            >
              {showFullDesc ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* ── Row 4: Dates or Status ── */}
      <div
        className="mt-2"
        style={{
          display: 'flex',
          gap: 16,
          fontSize: '13px',
          color: 'var(--text-tertiary)',
          lineHeight: '1.38',
          marginTop: 8,
        }}
      >
        {item.category === ItemCategory.MCP_SERVER ? (
          <span style={{
            color: item.metadata.authStatus === 'connected' ? 'var(--health-ok)' : 'var(--health-warn)',
            fontWeight: 500,
          }}>
            {item.metadata.authStatus === 'connected' ? '● Connected' : '● Needs authentication'}
          </span>
        ) : (
          <>
            {item.metadata.createdAt && (
              <span>{t('misc.created')}: {formatDate(item.metadata.createdAt)}</span>
            )}
            <span style={item.metadata.lastUsed ? { color: 'var(--accent)' } : undefined}>
              {t('misc.lastUsed')}: {item.metadata.lastUsed ? formatDate(item.metadata.lastUsed) : '-'}
            </span>
          </>
        )}
      </div>
    </article>
  );
}
