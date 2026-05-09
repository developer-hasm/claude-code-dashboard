'use client';

import { ItemCategory } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

/** Map category enum to CSS variable prefix (mcp_server -> mcp) */
const CSS_PREFIX: Record<ItemCategory, string> = {
  [ItemCategory.PLUGIN]: 'plugin',
  [ItemCategory.AGENT]: 'agent',
  [ItemCategory.SKILL]: 'skill',
  [ItemCategory.HOOK]: 'hook',
  [ItemCategory.COMMAND]: 'command',
  [ItemCategory.MCP_SERVER]: 'mcp',
  [ItemCategory.RULE]: 'rule',
  [ItemCategory.SESSION]: 'session',
  [ItemCategory.CONFIG]: 'config',
};

export interface CategoryBadgeProps {
  category: ItemCategory;
}

export default function CategoryBadge({ category }: CategoryBadgeProps) {
  const { t } = useI18n();
  const prefix = CSS_PREFIX[category];

  return (
    <span
      style={{
        background: `var(--cat-${prefix}-bg)`,
        color: `var(--cat-${prefix}-text)`,
        padding: '2px 8px',
        borderRadius: '9999px',
        font: '500 12px/1.5 var(--font-sans)',
        whiteSpace: 'nowrap',
      }}
    >
      {t(`category.${category}`)}
    </span>
  );
}
