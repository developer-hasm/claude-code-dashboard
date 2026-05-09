'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { DashboardItem, ItemCategory } from '@/lib/types';
import CategoryBadge from './CategoryBadge';
import ScopeBadge from './ScopeBadge';

export interface UnusedItemsProps {
  items: DashboardItem[];
}

/** Items never used, or not used in 30 days. Sessions/Config excluded. */
function isUnused(item: DashboardItem): boolean {
  if (item.category === 'session' || item.category === 'config') return false;
  const lastUsed = item.metadata.lastUsed;
  if (!lastUsed) return true; // Never used
  const daysSince = Math.floor((Date.now() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= 30;
}

function formatLastUsed(item: DashboardItem): string {
  const lastUsed = item.metadata.lastUsed;
  if (!lastUsed) return 'Never used';
  try {
    return `Last used: ${new Date(lastUsed).toISOString().slice(0, 10)}`;
  } catch {
    return 'Never used';
  }
}

const CATEGORY_ICONS: Record<string, string> = {
  plugin: 'M12 2L2 7l10 5 10-5-10-5z',
  agent: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2',
  skill: 'M22 11.08V12a10 10 0 11-5.93-9.14',
  hook: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71',
  command: 'M4 17l6-6-6-6M12 19h8',
  mcp_server: 'M22 12h-4l-3 9L9 3l-3 9H2',
  rule: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
  session: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  config: 'M12 15a3 3 0 100-6 3 3 0 000 6z',
};

export default function UnusedItems({ items }: UnusedItemsProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);

  const unused = items.filter(isUnused);

  return (
    <div
      className="shadow-ring"
      style={{
        background: 'var(--surface)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {t('unused.title')} (30d)
          {unused.length > 0 && (
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 8 }}>
              {unused.length}
            </span>
          )}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            color: 'var(--text-tertiary)',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: '0 20px 16px' }}>
          {unused.length === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              {t('empty.noUnused')}
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {unused.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-tertiary)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d={CATEGORY_ICONS[item.category as string] ?? CATEGORY_ICONS.plugin} />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </span>
                      <ScopeBadge scope={item.scope} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {formatLastUsed(item)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
