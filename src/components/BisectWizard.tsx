'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BisectResponse, BisectSession, InventorySummary, ItemCategory } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import CategoryBadge from './CategoryBadge';

// ── Types ─────────────────────────────────────────────────────────────────

type WizardState = 'IDLE' | 'TESTING' | 'FOUND' | 'RESTORED';

export interface BisectWizardProps {
  isOpen: boolean;
  onClose: () => void;
  csrfToken: string;
  inventory: InventorySummary;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function BisectWizard({ isOpen, onClose, csrfToken, inventory }: BisectWizardProps) {
  const { t } = useI18n();
  const [state, setState] = useState<WizardState>('IDLE');
  const [session, setSession] = useState<BisectSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testableItems = inventory.items.filter(
    (it) => it.category === 'plugin' || it.category === 'hook',
  );
  const maxRounds = Math.ceil(Math.log2(Math.max(testableItems.length, 1)));

  // Check for existing session on mount
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/bisect');
        if (!res.ok) return;
        const json = await res.json();
        const data: BisectResponse = json.data ?? json;
        if (cancelled) return;
        if (data.session && data.session.status === 'in_progress') {
          setSession(data.session);
          setState('TESTING');
        } else if (data.session?.status === 'completed' && data.session.suspectedItem) {
          setSession(data.session);
          setState('FOUND');
        }
      } catch {
        // No existing session
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const postBisect = useCallback(
    async (body: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/bisect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${csrfToken}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return (json.data ?? json) as BisectResponse;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [csrfToken],
  );

  const handleStart = useCallback(async () => {
    const resp = await postBisect({
      action: 'start',
      categories: ['plugin', 'hook'] as ItemCategory[],
    });
    if (resp) {
      setSession(resp.session);
      setState('TESTING');
    }
  }, [postBisect]);

  const handleVerdict = useCallback(
    async (verdict: 'good' | 'bad') => {
      if (!session) return;
      const resp = await postBisect({
        action: 'feedback',
        reproduced: verdict === 'bad',
      });
      if (resp) {
        setSession(resp.session);
        if (resp.session.status === 'completed') {
          setState(resp.session.suspectedItem ? 'FOUND' : 'RESTORED');
        }
      }
    },
    [session, postBisect],
  );

  const handleCancel = useCallback(async () => {
    if (!session) return;
    const resp = await postBisect({ action: 'abort' });
    if (resp) {
      setSession(null);
      setState('RESTORED');
    }
  }, [session, postBisect]);

  const handleClose = useCallback(() => {
    setState('IDLE');
    setSession(null);
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const currentRound = session?.rounds?.[session.rounds.length - 1];
  const roundNumber = currentRound?.roundNumber ?? 0;
  const progress = maxRounds > 0 ? (roundNumber / maxRounds) * 100 : 0;

  const suspectedName = session?.suspectedItem
    ? session.items.find((it) => it.id === session.suspectedItem)?.name ?? session.suspectedItem
    : null;
  const suspectedCategory = session?.suspectedItem
    ? session.items.find((it) => it.id === session.suspectedItem)?.category
    : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <div
        className="modal-enter shadow-modal"
        style={{
          background: 'var(--surface)',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '80vh',
          overflow: 'auto',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>
          {t('bisect.title')}
        </h2>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</div>
        )}

        {/* IDLE */}
        {state === 'IDLE' && (
          <>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 16px' }}>
              {t('bisect.description')}
            </p>
            <div
              style={{
                background: 'var(--bg)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                maxHeight: '200px',
                overflow: 'auto',
              }}
            >
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                Items to test ({testableItems.length}):
              </div>
              {testableItems.map((it) => (
                <div
                  key={it.id}
                  style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '2px 0' }}
                >
                  {it.name}
                </div>
              ))}
              {testableItems.length === 0 && (
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  No testable items found.
                </div>
              )}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
              Estimated rounds: {maxRounds}
            </div>
            <button
              type="button"
              disabled={loading || testableItems.length === 0}
              onClick={handleStart}
              style={{
                background: 'var(--primary)',
                color: 'var(--surface)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                font: '500 14px/1.5 var(--font-sans)',
                cursor: testableItems.length === 0 ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                width: '100%',
              }}
            >
              {loading ? t('misc.loading') : t('button.startBisect')}
            </button>
          </>
        )}

        {/* TESTING */}
        {state === 'TESTING' && session && (
          <>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Round {roundNumber} of {maxRounds}
            </div>
            {/* Progress bar */}
            <div
              style={{
                height: '6px',
                background: 'var(--border-strong)',
                borderRadius: '9999px',
                marginBottom: '16px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(progress, 100)}%`,
                  background: 'var(--accent)',
                  borderRadius: '9999px',
                  transition: 'width 300ms ease',
                }}
              />
            </div>
            {/* Disabled items */}
            {currentRound && currentRound.disabledItems.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                  Currently disabled:
                </div>
                <div
                  style={{
                    background: 'var(--bg)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    maxHeight: '120px',
                    overflow: 'auto',
                  }}
                >
                  {currentRound.disabledItems.map((id) => {
                    const item = session.items.find((it) => it.id === id);
                    return (
                      <div key={id} style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '2px 0' }}>
                        {item?.name ?? id}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '12px' }}>
              {t('bisect.verdict')}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleVerdict('bad')}
                style={{
                  flex: 1,
                  background: 'var(--danger-subtle)',
                  color: 'var(--danger)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  font: '500 14px/1.5 var(--font-sans)',
                  cursor: 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                Yes (still broken)
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleVerdict('good')}
                style={{
                  flex: 1,
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  font: '500 14px/1.5 var(--font-sans)',
                  cursor: 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                No (fixed now)
              </button>
            </div>
          </>
        )}

        {/* FOUND */}
        {state === 'FOUND' && suspectedName && (
          <>
            <div
              style={{
                background: 'var(--accent-subtle)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Found! The problematic item is:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {suspectedName}
                </span>
                {suspectedCategory && <CategoryBadge category={suspectedCategory} />}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={loading}
                onClick={handleClose}
                style={{
                  flex: 1,
                  background: 'var(--primary)',
                  color: 'var(--surface)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  font: '500 13px/1.5 var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                Keep Disabled
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleCancel}
                style={{
                  flex: 1,
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  font: '500 13px/1.5 var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                Re-enable All
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  if (!session?.suspectedItem) return;
                  setLoading(true);
                  try {
                    await fetch(`/api/items/${encodeURIComponent(session.suspectedItem)}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${csrfToken}` },
                    });
                    await postBisect({ action: 'abort' });
                    setState('RESTORED');
                  } catch {
                    setError('Failed to delete item');
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{
                  flex: 1,
                  background: 'var(--danger-subtle)',
                  color: 'var(--danger)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  font: '500 13px/1.5 var(--font-sans)',
                  cursor: 'pointer',
                }}
              >
                Delete Item
              </button>
            </div>
          </>
        )}

        {/* RESTORED */}
        {state === 'RESTORED' && (
          <>
            <div
              style={{
                background: 'var(--accent-subtle)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px',
                textAlign: 'center',
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}
            >
              Settings restored to original state.
            </div>
            <button
              type="button"
              onClick={handleClose}
              style={{
                width: '100%',
                background: 'var(--primary)',
                color: 'var(--surface)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                font: '500 14px/1.5 var(--font-sans)',
                cursor: 'pointer',
              }}
            >
              {t('button.close')}
            </button>
          </>
        )}

        {/* Abort button (available in IDLE, TESTING, FOUND) */}
        {state !== 'RESTORED' && (
          <button
            type="button"
            disabled={loading}
            onClick={state === 'IDLE' ? handleClose : handleCancel}
            style={{
              width: '100%',
              marginTop: '12px',
              background: 'transparent',
              border: 'none',
              padding: '8px',
              font: '500 13px/1.5 var(--font-sans)',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            {state === 'IDLE' ? t('button.cancel') : t('button.cancelBisect')}
          </button>
        )}
      </div>
    </div>
  );
}
