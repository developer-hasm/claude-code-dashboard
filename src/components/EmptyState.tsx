'use client';

import { useI18n } from '@/lib/i18n';
import type { ItemCategory } from '@/lib/types';

interface EmptyStateProps {
  category: ItemCategory | 'search';
  searchQuery?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  plugin: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  agent: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  skill: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  hook: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  command: 'M4 17l6-6-6-6M12 19h8',
  mcp_server: 'M22 12h-4l-3 9L9 3l-3 9H2',
  rule: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  search: 'M11 11m-8 0a8 8 0 1016 0 8 8 0 10-16 0M21 21l-4.35-4.35',
};

export function EmptyState({ category, searchQuery }: EmptyStateProps) {
  const { t } = useI18n();

  const iconPath = CATEGORY_ICONS[category === 'search' ? 'search' : category] ?? CATEGORY_ICONS.plugin;

  const message = searchQuery
    ? t('empty.noResults')
    : category === 'search'
      ? t('empty.noResults')
      : t('empty.noItemsInCategory').replace('{category}', t(`category.${category}`));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        gap: 12,
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-tertiary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.5 }}
      >
        <path d={iconPath} />
      </svg>
      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 300 }}>
        {message}
      </p>
    </div>
  );
}
