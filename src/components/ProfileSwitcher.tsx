'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProfileInfo } from '@/lib/types';
import { useI18n } from '@/lib/i18n';

// ── Props ─────────────────────────────────────────────────────────────────

export interface ProfileSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  csrfToken: string;
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/;
const RESERVED = ['default', 'current', 'backup', 'temp', 'none'];

// ── Component ─────────────────────────────────────────────────────────────

export default function ProfileSwitcher({
  isOpen,
  onClose,
  csrfToken,
}: ProfileSwitcherProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ── Fetch profiles ──────────────────────────────────────────────────────

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profiles', {
        headers: { Authorization: `Bearer ${csrfToken}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data ?? json;
      setProfiles(data.profiles ?? []);
      setActiveProfile(data.activeProfile ?? null);
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  useEffect(() => {
    if (isOpen) fetchProfiles();
  }, [isOpen, fetchProfiles]);

  // ── Escape key ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ── Name validation ─────────────────────────────────────────────────────

  const validateName = useCallback((name: string) => {
    if (name.length < 1 || name.length > 50) return 'Name must be 1-50 characters';
    if (!NAME_PATTERN.test(name)) return 'Only lowercase a-z, 0-9, and hyphens allowed';
    if (RESERVED.includes(name)) return 'Reserved name';
    return null;
  }, []);

  // ── Save current ────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const err = validateName(newName);
    if (err) { setNameError(err); return; }
    setNameError(null);
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${csrfToken}` },
        body: JSON.stringify({ action: 'save', name: newName }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewName('');
      fetchProfiles();
    } catch {
      setNameError(t('error.saveFailed'));
    }
  }, [csrfToken, fetchProfiles, newName, t, validateName]);

  // ── Switch profile ──────────────────────────────────────────────────────

  const handleSwitch = useCallback(async (name: string) => {
    try {
      await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${csrfToken}` },
        body: JSON.stringify({ action: 'switch', name }),
      });
      setConfirmSwitch(null);
      fetchProfiles();
    } catch { /* ignore */ }
  }, [csrfToken, fetchProfiles]);

  // ── Delete profile ──────────────────────────────────────────────────────

  const handleDelete = useCallback(async (name: string) => {
    try {
      await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${csrfToken}` },
        body: JSON.stringify({ action: 'delete', name }),
      });
      setConfirmDelete(null);
      fetchProfiles();
    } catch { /* ignore */ }
  }, [csrfToken, fetchProfiles]);

  // ── Format helpers ──────────────────────────────────────────────────────

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();
  const formatSize = (info: ProfileInfo) => `${info.itemCount} items`;

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
        aria-label={t('profiles.title')}
        className="modal-enter shadow-modal w-full max-w-md"
        style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          {t('profiles.title')}
        </h2>

        {/* Profile list */}
        <div className="mt-4 hide-scrollbar flex flex-col gap-1" style={{ maxHeight: '260px', overflowY: 'auto', marginTop: '16px' }}>
          {loading && <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{t('misc.loading')}</span>}
          {!loading && profiles.length === 0 && (
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{t('empty.noProfiles')}</span>
          )}
          {profiles.map((p) => (
            <div key={p.name}>
              {/* Confirm switch inline */}
              {confirmSwitch === p.name ? (
                <div className="rounded-lg px-3 py-2" style={{ background: 'var(--accent-subtle)', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-primary)' }}>
                    Switch to &apos;{p.name}&apos;? Current state will be backed up.
                  </span>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSwitch(p.name)}
                      className="cursor-pointer rounded-md px-3 py-1"
                      style={{ font: '500 12px/1.4 var(--font-sans)', background: 'var(--accent)', color: '#fff', border: 'none' }}
                    >
                      {t('button.confirm')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmSwitch(null)}
                      className="cursor-pointer rounded-md px-3 py-1"
                      style={{ font: '500 12px/1.4 var(--font-sans)', background: 'var(--surface)', color: 'var(--text-secondary)', border: 'none' }}
                    >
                      {t('button.cancel')}
                    </button>
                  </div>
                </div>
              ) : confirmDelete === p.name ? (
                <div className="rounded-lg px-3 py-2" style={{ background: 'var(--danger-subtle)', fontSize: '13px' }}>
                  <span style={{ color: 'var(--danger)' }}>Delete &apos;{p.name}&apos;?</span>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(p.name)}
                      className="cursor-pointer rounded-md px-3 py-1"
                      style={{ font: '500 12px/1.4 var(--font-sans)', background: 'var(--danger)', color: '#fff', border: 'none' }}
                    >
                      {t('button.delete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="cursor-pointer rounded-md px-3 py-1"
                      style={{ font: '500 12px/1.4 var(--font-sans)', background: 'var(--surface)', color: 'var(--text-secondary)', border: 'none' }}
                    >
                      {t('button.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2"
                  style={{ transition: 'background 100ms ease' }}
                  onClick={() => p.name !== activeProfile && setConfirmSwitch(p.name)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="flex items-center gap-2">
                    {/* Active checkmark */}
                    {p.name === activeProfile ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="M3 7l3 3 5-6" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span style={{ width: '14px' }} />
                    )}
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block' }}>
                        {formatDate(p.createdAt)} &middot; {formatSize(p)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(p.name); }}
                    className="cursor-pointer rounded-md p-1"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', lineHeight: 0 }}
                    aria-label={`Delete ${p.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Save current section */}
        <div
          className="mt-4"
          style={{ borderTop: '1px solid var(--border-strong)', paddingTop: '16px', marginTop: '16px' }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Save Current
          </span>
          <div className="mt-2 flex gap-2" style={{ marginTop: '8px' }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setNameError(null); }}
              placeholder="profile-name"
              className="flex-1 rounded-md px-3 py-2"
              style={{
                font: '400 13px/1.4 var(--font-sans)',
                background: 'var(--bg)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: '6px',
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring)'; }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!newName}
              className="cursor-pointer rounded-md px-4 py-2"
              style={{
                font: '500 13px/1.4 var(--font-sans)',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                opacity: newName ? 1 : 0.5,
              }}
            >
              {t('button.save')}
            </button>
          </div>
          {nameError && (
            <span style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px', display: 'block' }}>
              {nameError}
            </span>
          )}
        </div>

        {/* Close button */}
        <div className="mt-4 flex justify-end" style={{ marginTop: '16px' }}>
          <button
            type="button"
            onClick={onClose}
            className="shadow-ring cursor-pointer rounded-lg px-4 py-2"
            style={{ font: '500 14px/1.4 var(--font-sans)', background: 'var(--surface)', color: 'var(--text-primary)', border: 'none' }}
          >
            {t('button.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
