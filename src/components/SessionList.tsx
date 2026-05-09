'use client';

import { useCallback, useMemo, useState } from 'react';
import type { DashboardItem } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import SessionConversationModal from './SessionConversationModal';

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    const ts = Number(iso);
    const d = isNaN(ts) ? new Date(iso) : new Date(ts);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Component ─────────────────────────────────────────────────────────────

export interface SessionListProps {
  items: DashboardItem[];
  csrfToken: string;
  onDelete?: (item: DashboardItem) => void;
}

export default function SessionList({ items, csrfToken, onDelete }: SessionListProps) {
  const { t } = useI18n();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewingSession, setViewingSession] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const aTime = String(a.metadata.startedAt ?? a.lastModified ?? '');
      const bTime = String(b.metadata.startedAt ?? b.lastModified ?? '');
      return bTime.localeCompare(aTime);
    });
  }, [items]);

  const handleDelete = useCallback(async (session: DashboardItem) => {
    setDeleting(session.id);
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(session.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${csrfToken}` },
      });
      if (res.ok) {
        onDelete?.(session);
      }
    } catch { /* ignore */ }
    setDeleting(null);
    setDeleteConfirm(null);
  }, [csrfToken, onDelete]);

  if (sorted.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-tertiary)' }}>
        No recent sessions
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((session) => {
        const kind = session.metadata.kind ?? 'interactive';
        const startedAt = session.metadata.startedAt ?? session.lastModified;
        const firstPrompt = session.metadata.firstPrompt ?? '';
        const messageCount = Number(session.metadata.messageCount) || 0;
        const toolCallCount = Number(session.metadata.toolCallCount) || 0;
        const totalTokens = Number(session.metadata.totalTokens) || 0;
        const inputTokens = Number(session.metadata.inputTokens) || 0;
        const diskSize = Number(session.metadata.diskSize) || 0;
        const saturation = Number(session.metadata.contextSaturation) || 0;
        const isConfirming = deleteConfirm === session.id;
        const isDeleting = deleting === session.id;

        return (
          <div
            key={session.id}
            className="card shadow-ring"
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: 16,
            }}
          >
            {/* Row 1: First prompt (title) + kind badge + delete */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4 }}>
                  {firstPrompt || `Session ${session.name.slice(0, 8)}...`}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {(firstPrompt.includes('scheduled') || firstPrompt.includes('automated')) && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 9999,
                      font: '500 11px/1.45 var(--font-sans)',
                      background: 'var(--cat-hook-bg)',
                      color: 'var(--cat-hook-text)',
                    }}>
                      scheduled
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {formatDateTime(session.metadata.firstMessageAt || startedAt)}
                  </span>
                  {session.metadata.lastMessageAt && session.metadata.lastMessageAt !== session.metadata.firstMessageAt && (
                    <>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>→</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {formatDateTime(session.metadata.lastMessageAt)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Delete button */}
              {!isConfirming ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(session.id)}
                  style={{
                    font: '500 12px/1.38 var(--font-sans)',
                    color: 'var(--danger)',
                    background: 'var(--danger-subtle)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {t('button.delete')}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    style={{
                      font: '500 11px/1.38 var(--font-sans)',
                      color: 'var(--text-secondary)',
                      background: 'var(--surface)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                    }}
                    className="shadow-ring"
                  >
                    {t('button.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleDelete(session)}
                    style={{
                      font: '500 11px/1.38 var(--font-sans)',
                      color: '#fff',
                      background: 'var(--danger)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      opacity: isDeleting ? 0.6 : 1,
                    }}
                  >
                    {isDeleting ? '...' : 'Confirm'}
                  </button>
                </div>
              )}
            </div>

            {/* Row 2: Stats bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              <StatPill label="Messages" value={String(messageCount)} onClick={() => setViewingSession(session.metadata.sessionId)} />
              <StatPill label="Tool calls" value={String(toolCallCount)} />
              <StatPill label="Tokens" value={formatTokens(totalTokens)} highlight={totalTokens > 500_000} />
              <StatPill label="Disk" value={formatSize(diskSize)} highlight={diskSize > 5 * 1024 * 1024} />
              {session.metadata.totalCost && Number(session.metadata.totalCost) > 0 && (
                <StatPill label="" value={`~$${Number(session.metadata.totalCost).toFixed(2)}`} />
              )}
              <SaturationBar value={saturation} />
            </div>

            {/* Delete warning */}
            {isConfirming && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: 'var(--warn-bg)',
                  color: 'var(--warn-text)',
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                이 세션을 삭제하면 <code>claude --resume</code>으로 이어갈 수 없습니다.
              </div>
            )}
          </div>
        );
      })}
      <SessionConversationModal sessionId={viewingSession} onClose={() => setViewingSession(null)} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatPill({ label, value, highlight, onClick }: { label: string; value: string; highlight?: boolean; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{
        padding: '2px 8px',
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 9999,
        font: '500 11px/1.45 var(--font-sans)',
        background: highlight ? 'var(--warn-bg)' : 'var(--bg)',
        color: onClick ? 'var(--accent)' : highlight ? 'var(--warn-text)' : 'var(--text-secondary)',
        textDecoration: onClick ? 'underline' : 'none',
      }}
    >
      {value} {label}
    </span>
  );
}

function SaturationBar({ value }: { value: number }) {
  const color = value >= 80 ? 'var(--danger)' : value >= 50 ? 'var(--health-warn)' : 'var(--health-ok)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 9999,
        font: '500 11px/1.45 var(--font-sans)',
        background: 'var(--bg)',
        color: 'var(--text-secondary)',
      }}
    >
      Context
      <span style={{
        width: 40,
        height: 4,
        borderRadius: 2,
        background: 'var(--border-strong)',
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <span style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: `${Math.min(100, value)}%`,
          background: color,
          borderRadius: 2,
        }} />
      </span>
      {value}%
    </span>
  );
}
