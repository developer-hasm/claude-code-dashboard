'use client';

import { useI18n } from '@/lib/i18n';
import { ItemCategory } from '@/lib/types';

type SelectedCategory = ItemCategory | 'all' | 'overview';

interface SidebarProps {
  selectedCategory: SelectedCategory;
  onSelectCategory: (cat: SelectedCategory) => void;
  counts: Record<ItemCategory, number>;
  totalCount: number;
}

const INVENTORY_CATEGORIES: ItemCategory[] = [
  ItemCategory.PLUGIN,
  ItemCategory.AGENT,
  ItemCategory.SKILL,
  ItemCategory.HOOK,
  ItemCategory.COMMAND,
  ItemCategory.MCP_SERVER,
];

const MONITORING_CATEGORIES: ItemCategory[] = [
  ItemCategory.SESSION,
];

function catBadgeKey(cat: ItemCategory): string {
  return cat === 'mcp_server' ? 'mcp' : cat;
}

function NavItem({
  label,
  count,
  active,
  onClick,
  catKey,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  catKey?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '6px 12px',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        background: active ? 'var(--accent-subtle)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        transition: 'background 120ms ease',
      }}
    >
      <span>{label}</span>
      {count >= 0 && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '1px 7px',
            borderRadius: 'var(--radius-full)',
            background: catKey ? `var(--cat-${catKey}-bg)` : 'var(--surface)',
            color: catKey ? `var(--cat-${catKey}-text)` : 'var(--text-tertiary)',
            minWidth: 20,
            textAlign: 'center',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function Sidebar({ selectedCategory, onSelectCategory, counts, totalCount }: SidebarProps) {
  const { t } = useI18n();

  // ── Desktop sidebar ──
  const desktopSidebar = (
    <aside
      className="sidebar-border hidden md:flex md:flex-col"
      style={{
        width: 208,
        flexShrink: 0,
        gap: 4,
        padding: '16px 10px',
        background: 'var(--surface)',
        overflowY: 'auto',
        height: 'calc(100vh - 52px)',
        position: 'sticky',
        top: 52,
      }}
    >
      {/* Overview */}
      <NavItem
        label={t('sidebar.overview')}
        count={-1}
        active={selectedCategory === 'overview'}
        onClick={() => onSelectCategory('overview')}
      />
      <div style={{ height: 12 }} />

      {[...INVENTORY_CATEGORIES, ...MONITORING_CATEGORIES].map((cat) => (
        <NavItem
          key={cat}
          label={t(`category.${cat}`)}
          count={counts[cat] ?? 0}
          active={selectedCategory === cat}
          onClick={() => onSelectCategory(cat)}
          catKey={catBadgeKey(cat)}
        />
      ))}
    </aside>
  );

  // ── Mobile tab bar ──
  const allCategories: SelectedCategory[] = ['overview', ...INVENTORY_CATEGORIES, ...MONITORING_CATEGORIES];
  const mobileTabBar = (
    <div
      className="flex md:hidden scroll-fade hide-scrollbar"
      style={{
        overflowX: 'auto',
        gap: 6,
        padding: '10px 16px',
        background: 'var(--surface)',
        position: 'sticky',
        top: 52,
        zIndex: 30,
      }}
    >
      {allCategories.map((cat) => {
        const active = selectedCategory === cat;
        const label = cat === 'overview' ? t('sidebar.overview') : cat === 'all' ? t('sidebar.allItems') : t(`category.${cat}`);
        return (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            style={{
              flexShrink: 0,
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              background: active ? 'var(--accent-subtle)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {desktopSidebar}
      {mobileTabBar}
    </>
  );
}
