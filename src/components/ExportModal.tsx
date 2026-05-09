'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { InventorySummary, ItemCategory } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

// ── Props ─────────────────────────────────────────────────────────────────

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventorySummary;
  csrfToken: string;
}

type ExportMode = 'all' | 'selected';

// ── Component ─────────────────────────────────────────────────────────────

export default function ExportModal({
  isOpen,
  onClose,
  inventory,
  csrfToken,
}: ExportModalProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<ExportMode>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeLocal, setIncludeLocal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // ── Escape key ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ── Group items by category ─────────────────────────────────────────────

  const grouped = inventory.items.reduce<Record<string, typeof inventory.items>>(
    (acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    },
    {},
  );

  // ── Selection helpers ───────────────────────────────────────────────────

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Export handler ──────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        mode,
        includeLocalSettings: includeLocal,
        ...(mode === 'selected' ? { itemIds: [...selectedIds] } : {}),
      };
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${csrfToken}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(t('error.exportFailed').replace('{reason}', `HTTP ${res.status}`));
      const data = await res.json();

      const exportData = data.data ?? data;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '.claude-profile.json';
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('error.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  }, [csrfToken, includeLocal, mode, onClose, selectedIds, t]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('modal.exportTitle')}
        className="modal-enter shadow-modal w-full max-w-md"
        style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}
      >
        {/* Title */}
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Export Environment
        </h2>

        {/* Mode tabs */}
        <div className="mt-4 flex gap-1" style={{ background: 'var(--bg)', borderRadius: '8px', padding: '3px' }}>
          {(['all', 'selected'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="cursor-pointer flex-1 rounded-md px-3 py-1.5"
              style={{
                font: '500 13px/1.4 var(--font-sans)',
                border: 'none',
                background: mode === m ? 'var(--surface)' : 'transparent',
                color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: mode === m ? 'var(--border) 0px 0px 0px 1px' : 'none',
                transition: 'background 150ms ease, color 150ms ease',
              }}
            >
              {m === 'all' ? 'Export All' : 'Export Selected'}
            </button>
          ))}
        </div>

        {/* Selected mode: checklist */}
        {mode === 'selected' && (
          <div
            className="mt-3 hide-scrollbar"
            style={{ maxHeight: '220px', overflowY: 'auto', marginTop: '12px' }}
          >
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {t(`category.${category}`)}
                </span>
                {items.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1"
                    style={{ fontSize: '13px', color: 'var(--text-primary)' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    {item.name}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Include local toggle */}
        <label className="mt-3 flex cursor-pointer items-center gap-3" style={{ marginTop: '14px' }}>
          <div
            className={`toggle-track${includeLocal ? ' on' : ''}`}
            onClick={() => setIncludeLocal((v) => !v)}
          >
            <div className="toggle-thumb" />
          </div>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Include local settings items
          </span>
        </label>

        {/* Warning banner */}
        <div
          className="mt-3 flex items-start gap-2 rounded-lg"
          style={{
            background: 'var(--warn-bg)',
            border: '1px solid var(--warn-border)',
            padding: '10px 12px',
            marginTop: '12px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
            <path d="M8 2L14.5 13.5H1.5L8 2z" stroke="var(--warn-text)" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
            <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="var(--warn-text)" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="11.2" r="0.7" fill="var(--warn-text)" />
          </svg>
          <span style={{ fontSize: '13px', color: 'var(--warn-text)', lineHeight: '1.4' }}>
            This file may contain sensitive information. Review before sharing.
          </span>
        </div>

        {/* Error */}
        {error && (
          <div
            aria-live="polite"
            className="mt-3 rounded-lg"
            style={{ background: 'var(--danger-subtle)', color: 'var(--danger)', padding: '8px 12px', fontSize: '13px', marginTop: '12px' }}
          >
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="mt-4 flex items-center justify-end gap-3" style={{ marginTop: '20px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="shadow-ring cursor-pointer rounded-lg px-4 py-2"
            style={{ font: '500 14px/1.4 var(--font-sans)', background: 'var(--surface)', color: 'var(--text-primary)', border: 'none' }}
          >
            {t('button.cancel')}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || (mode === 'selected' && selectedIds.size === 0)}
            className="cursor-pointer rounded-lg px-4 py-2"
            style={{
              font: '500 14px/1.4 var(--font-sans)',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              opacity: isExporting || (mode === 'selected' && selectedIds.size === 0) ? 0.5 : 1,
              transition: 'opacity 150ms ease',
            }}
          >
            {isExporting && (
              <svg className="mr-2 inline-block animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="24" strokeLinecap="round" />
              </svg>
            )}
            {t('button.export')}
          </button>
        </div>
      </div>
    </div>
  );
}
