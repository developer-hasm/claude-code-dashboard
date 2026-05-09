'use client';

import { ItemScope } from '@/lib/types';

export interface ScopeBadgeProps {
  scope: ItemScope;
}

export default function ScopeBadge({ scope }: ScopeBadgeProps) {
  const key = scope === ItemScope.PROJECT ? 'project' : 'global';

  return (
    <span
      style={{
        background: `var(--scope-${key}-bg)`,
        color: `var(--scope-${key}-text)`,
        padding: '2px 6px',
        borderRadius: '9999px',
        font: '500 11px/1.45 var(--font-sans)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
      }}
    >
      {key}
    </span>
  );
}
