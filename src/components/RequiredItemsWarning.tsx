'use client';

import type { InventorySummary, RequiredItem, ItemCategory, ProjectType } from '@/lib/types';
import CategoryBadge from './CategoryBadge';

export interface RequiredItemsWarningProps {
  inventory: InventorySummary;
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

/** Required items per project type (subset). */
function getRequiredItems(projectPath: string | null): RequiredItem[] {
  if (!projectPath) return [];
  const p = projectPath.toLowerCase();

  const items: RequiredItem[] = [];

  // Next.js projects need certain configs
  if (p.includes('next')) {
    items.push(
      { category: 'skill' as ItemCategory, name: 'fullstack-webapp', reason: 'Core orchestrator for Next.js projects', installed: false },
      { category: 'rule' as ItemCategory, name: 'nextjs-conventions', reason: 'Next.js App Router conventions and best practices', installed: false },
    );
  }

  // All projects benefit from security checklist
  items.push(
    { category: 'skill' as ItemCategory, name: 'api-security-checklist', reason: 'API security baseline (OWASP Top 10)', installed: false },
  );

  return items;
}

export default function RequiredItemsWarning({ inventory }: RequiredItemsWarningProps) {
  const requiredItems = getRequiredItems(inventory.projectPath);
  const existingNames = new Set(inventory.items.map((i) => i.name.toLowerCase()));

  // Mark installed status
  const itemsWithStatus = requiredItems.map((r) => ({
    ...r,
    installed: existingNames.has(r.name.toLowerCase()),
  }));

  const missing = itemsWithStatus.filter((r) => !r.installed);

  // Hidden when all present or no project context
  if (missing.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--danger-subtle)',
        borderRadius: '8px',
        padding: '16px 20px',
        border: '1px solid var(--danger)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {/* Warning icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M8 2L14.5 13.5H1.5L8 2z"
            stroke="var(--danger)"
            strokeWidth="1.3"
            strokeLinejoin="round"
            fill="none"
          />
          <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="var(--danger)" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="11.2" r="0.7" fill="var(--danger)" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>
          Missing Required Items ({missing.length})
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {missing.map((item) => (
          <div
            key={item.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--danger)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, opacity: 0.7 }}
            >
              <path d={CATEGORY_ICONS[item.category] ?? CATEGORY_ICONS.plugin} />
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--danger)' }}>
                  {item.name}
                </span>
                <CategoryBadge category={item.category} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {item.reason}
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--accent)',
                cursor: 'pointer',
                fontWeight: 500,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              How to install
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
