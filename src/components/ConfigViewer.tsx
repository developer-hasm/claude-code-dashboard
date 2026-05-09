'use client';

import { useCallback, useMemo, useState } from 'react';
import type { DashboardItem, InventorySummary } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import ScopeBadge from './ScopeBadge';

// ── JSON Syntax Highlighter ───────────────────────────────────────────────

function highlightJson(raw: string): Array<{ text: string; color: string }> {
  const parts: Array<{ text: string; color: string }> = [];
  // Simple token-based highlight
  const regex = /("(?:[^"\\]|\\.)*")\s*:/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const fullText = raw;
  while ((match = regex.exec(fullText)) !== null) {
    // Text before key
    if (match.index > lastIndex) {
      const segment = fullText.slice(lastIndex, match.index);
      parts.push(...highlightValues(segment));
    }
    // Key
    parts.push({ text: match[1], color: 'var(--accent)' });
    parts.push({ text: ':', color: 'var(--text-tertiary)' });
    lastIndex = match.index + match[0].length;
  }
  // Remaining
  if (lastIndex < fullText.length) {
    parts.push(...highlightValues(fullText.slice(lastIndex)));
  }
  return parts;
}

function highlightValues(text: string): Array<{ text: string; color: string }> {
  const parts: Array<{ text: string; color: string }> = [];
  const valRegex = /("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(true|false|null)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = valRegex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push({ text: text.slice(lastIdx, m.index), color: 'var(--text-tertiary)' });
    }
    if (m[1]) parts.push({ text: m[1], color: 'var(--text-secondary)' });
    else if (m[2]) parts.push({ text: m[2], color: 'var(--health-ok)' });
    else if (m[3]) parts.push({ text: m[3], color: 'var(--accent)' });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    parts.push({ text: text.slice(lastIdx), color: 'var(--text-tertiary)' });
  }
  return parts;
}

// ── Collapsible Section ───────────────────────────────────────────────────

function ConfigSection({
  title,
  badge,
  keyCount,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  keyCount?: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="shadow-ring"
      style={{
        background: 'var(--surface)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '8px',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            flexShrink: 0,
          }}
        >
          <path d="M5 3L9 7L5 11" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          {title}
        </span>
        {badge}
        {keyCount != null && (
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            {keyCount} keys
          </span>
        )}
      </button>
      {expanded && <div style={{ marginTop: '12px' }}>{children}</div>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export interface ConfigViewerProps {
  items: DashboardItem[];
  inventory: InventorySummary;
}

export default function ConfigViewer({ items, inventory }: ConfigViewerProps) {
  const { t } = useI18n();

  // Extract special data from inventory metadata
  const permissionMode = useMemo(() => {
    for (const item of items) {
      if (item.metadata.permissionMode) return item.metadata.permissionMode;
    }
    return null;
  }, [items]);

  const marketplaces = useMemo(() => {
    for (const item of items) {
      if (item.metadata.marketplaces) {
        try { return JSON.parse(item.metadata.marketplaces) as string[]; } catch { /* skip */ }
      }
    }
    return [];
  }, [items]);

  const enabledPlugins = useMemo(() => {
    return inventory.items
      .filter((it) => it.category === 'plugin' && it.metadata.enabled !== 'false')
      .map((it) => it.name);
  }, [inventory]);

  return (
    <div>
      {/* Special sections */}
      {permissionMode && (
        <ConfigSection title="Permission Mode">
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              color: 'var(--accent)',
              padding: '8px 12px',
              background: 'var(--bg)',
              borderRadius: '6px',
            }}
          >
            {permissionMode}
          </div>
        </ConfigSection>
      )}

      {marketplaces.length > 0 && (
        <ConfigSection title="Registered Marketplaces" keyCount={marketplaces.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {marketplaces.map((mp, i) => (
              <div
                key={i}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  padding: '4px 12px',
                  background: 'var(--bg)',
                  borderRadius: '6px',
                }}
              >
                {mp}
              </div>
            ))}
          </div>
        </ConfigSection>
      )}

      {enabledPlugins.length > 0 && (
        <ConfigSection title="Enabled Plugins" keyCount={enabledPlugins.length}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {enabledPlugins.map((name) => (
              <div
                key={name}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  padding: '4px 12px',
                  background: 'var(--bg)',
                  borderRadius: '6px',
                }}
              >
                {name}
              </div>
            ))}
          </div>
        </ConfigSection>
      )}

      {/* Config items */}
      {items.map((item) => {
        let parsed: Record<string, unknown> | null = null;
        let keyCount = 0;
        let jsonStr = '';
        try {
          parsed = JSON.parse(item.metadata.content ?? '{}');
          keyCount = Object.keys(parsed ?? {}).length;
          jsonStr = JSON.stringify(parsed, null, 2);
        } catch {
          jsonStr = item.metadata.content ?? '{}';
        }

        const highlighted = highlightJson(jsonStr);

        return (
          <ConfigSection
            key={item.id}
            title={item.name}
            badge={<ScopeBadge scope={item.scope} />}
            keyCount={keyCount}
          >
            <pre
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                lineHeight: '1.5',
                margin: 0,
                padding: '12px',
                background: 'var(--bg)',
                borderRadius: '6px',
                overflow: 'auto',
                maxHeight: '320px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {highlighted.map((part, i) => (
                <span key={i} style={{ color: part.color }}>
                  {part.text}
                </span>
              ))}
            </pre>
          </ConfigSection>
        );
      })}

      {items.length === 0 && !permissionMode && marketplaces.length === 0 && enabledPlugins.length === 0 && (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            font: '400 14px/1.5 var(--font-sans)',
            color: 'var(--text-tertiary)',
          }}
        >
          {t('empty.noItems')}
        </div>
      )}
    </div>
  );
}
