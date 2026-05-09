'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardItem, ItemScope } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

// ── Props ─────────────────────────────────────────────────────────────────

export interface DeleteModalProps {
  item: DashboardItem | null;
  onConfirm: (item: DashboardItem) => Promise<void>;
  onCancel: () => void;
  dependents?: string[];
  dependencies?: string[];
}

// ── Component ─────────────────────────────────────────────────────────────

export default function DeleteModal({
  item,
  onConfirm,
  onCancel,
  dependents,
  dependencies,
}: DeleteModalProps) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // ── Focus trap ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!item) return;
    // Focus cancel button on mount
    cancelRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [item, onCancel]);

  // ── Delete handler ────────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    if (!item) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(item);
      onCancel(); // close on success
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : String(err);
      if (msg.includes('409')) {
        setError('Item modified externally. Refresh & Retry');
      } else {
        setError(msg || t('error.deleteFailed'));
      }
    } finally {
      setIsDeleting(false);
    }
  }, [item, onConfirm, onCancel, t]);

  // ── Don't render when no item ─────────────────────────────────────────

  if (!item) return null;

  const isGlobal = item.scope === ItemScope.GLOBAL;
  const isRequired = item.metadata.required === 'true';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Delete ${item.name}?`}
        className="modal-enter shadow-destructive-modal w-full max-w-md"
        style={{
          background: 'var(--surface)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Delete {item.name}?
        </h2>

        {/* Body */}
        <p
          className="mt-3"
          style={{
            fontSize: '14px',
            fontWeight: 400,
            color: 'var(--text-secondary)',
            lineHeight: '1.5',
            margin: '12px 0 0',
          }}
        >
          This will permanently delete{' '}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
            {item.filePath}
          </span>
          .
        </p>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: '1.5',
            margin: '8px 0 0',
          }}
        >
          A backup will be saved to trash for 24 hours.
        </p>

        {/* Global scope warning */}
        {isGlobal && (
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
              This is a global item. Removing it will affect all projects.
            </span>
          </div>
        )}

        {/* Dependents warning */}
        {dependents && dependents.length > 0 && (
          <div
            className="mt-3 flex flex-col gap-1 rounded-lg"
            style={{
              background: 'var(--warn-bg)',
              border: '1px solid var(--warn-border)',
              padding: '10px 12px',
              marginTop: '12px',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--warn-text)', fontWeight: 500 }}>
              The following items depend on this:
            </span>
            <ul style={{ margin: 0, paddingLeft: '16px' }}>
              {dependents.map((dep) => (
                <li key={dep} style={{ fontSize: '13px', color: 'var(--warn-text)' }}>
                  {dep}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Dependencies info (items this uses) */}
        {dependencies && dependencies.length > 0 && (
          <div
            className="mt-3 flex flex-col gap-1 rounded-lg"
            style={{
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent)',
              padding: '10px 12px',
              marginTop: '12px',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 500 }}>
              This item references:
            </span>
            <ul style={{ margin: 0, paddingLeft: '16px' }}>
              {dependencies.map((dep) => (
                <li key={dep} style={{ fontSize: '13px', color: 'var(--accent)' }}>
                  {dep}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Required item warning */}
        {isRequired && (
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
              This item is marked as required.
            </span>
          </div>
        )}

        {/* Inline error */}
        {error && (
          <div
            aria-live="polite"
            className="mt-3 rounded-lg"
            style={{
              background: 'var(--danger-subtle)',
              color: 'var(--danger)',
              padding: '8px 12px',
              fontSize: '13px',
              marginTop: '12px',
            }}
          >
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="mt-4 flex items-center justify-end gap-3" style={{ marginTop: '20px' }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="shadow-ring cursor-pointer rounded-lg px-4 py-2"
            style={{
              font: '500 14px/1.4 var(--font-sans)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: 'none',
            }}
          >
            {t('button.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="cursor-pointer rounded-lg px-4 py-2"
            style={{
              font: '500 14px/1.4 var(--font-sans)',
              background: isDeleting ? 'var(--danger-subtle)' : 'var(--danger-subtle)',
              color: 'var(--danger)',
              border: 'none',
              transition: 'background 150ms ease, color 150ms ease',
              opacity: isDeleting ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isDeleting) {
                e.currentTarget.style.background = 'var(--danger)';
                e.currentTarget.style.color = '#fff';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--danger-subtle)';
              e.currentTarget.style.color = 'var(--danger)';
            }}
          >
            {isDeleting && (
              <svg
                className="mr-2 inline-block animate-spin"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="24" strokeLinecap="round" />
              </svg>
            )}
            {t('button.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
