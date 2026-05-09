'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExportProfile,
  ImportPreviewItem,
  ImportPreviewResponse,
  ImportApplyResponse,
  ImportResultItem,
} from '@/lib/types';
import { useI18n } from '@/lib/i18n';

// ── Props ─────────────────────────────────────────────────────────────────

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  csrfToken: string;
  onImportComplete: () => void;
}

type ImportStep = 1 | 2 | 3;
type ImportMode = 'merge' | 'overwrite' | 'clean';
type ConflictResolution = 'skip' | 'overwrite';

// ── Component ─────────────────────────────────────────────────────────────

export default function ImportModal({
  isOpen,
  onClose,
  csrfToken,
  onImportComplete,
}: ImportModalProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1 state
  const [step, setStep] = useState<ImportStep>(1);
  const [profile, setProfile] = useState<ExportProfile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Step 2 state
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, ConflictResolution>>({});
  const [cleanConfirmText, setCleanConfirmText] = useState('');
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Step 3 state
  const [result, setResult] = useState<ImportApplyResponse | null>(null);
  const [backupPath, setBackupPath] = useState<string | null>(null);

  // ── Reset on close/open ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setProfile(null);
      setFileError(null);
      setPreview(null);
      setMode('merge');
      setConflictResolutions({});
      setCleanConfirmText('');
      setApplyError(null);
      setResult(null);
      setBackupPath(null);
    }
  }, [isOpen]);

  // ── Escape key ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // ── File parsing ────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setFileError(null);
    if (!file.name.endsWith('.json')) {
      setFileError(t('error.invalidFile'));
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ExportProfile;
      if (!parsed.version || !parsed.agents) {
        setFileError(t('error.invalidFile'));
        return;
      }
      setProfile(parsed);

      // Fetch preview
      setPreviewLoading(true);
      const res = await fetch('/api/import/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${csrfToken}`,
        },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const previewData = (json.data ?? json) as ImportPreviewResponse;
      setPreview(previewData);

      // Initialize conflict resolutions
      const resolutions: Record<string, ConflictResolution> = {};
      (previewData.items ?? [])
        .filter((item) => item.conflictsWith)
        .forEach((item) => { resolutions[`${item.category}:${item.name}`] = 'skip'; });
      setConflictResolutions(resolutions);

      setStep(2);
    } catch {
      setFileError(t('error.invalidFile'));
    } finally {
      setPreviewLoading(false);
    }
  }, [csrfToken, t]);

  // ── Drag & drop ─────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => { setIsDragging(false); }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Conflict resolution helper ──────────────────────────────────────────

  const setResolution = useCallback((key: string, value: ConflictResolution) => {
    setConflictResolutions((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Apply handler ───────────────────────────────────────────────────────

  const handleApply = useCallback(async () => {
    if (!profile) return;
    setIsApplying(true);
    setApplyError(null);
    try {
      const res = await fetch('/api/import/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${csrfToken}`,
        },
        body: JSON.stringify({
          profile,
          mode,
          resolutions: conflictResolutions,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const applyResult = data.data ?? data;
      setResult(applyResult as ImportApplyResponse);
      setBackupPath(applyResult.backupPath ?? null);
      setStep(3);
      onImportComplete();
    } catch (err: unknown) {
      setApplyError(err instanceof Error ? err.message : t('error.importFailed'));
    } finally {
      setIsApplying(false);
    }
  }, [conflictResolutions, csrfToken, mode, onImportComplete, profile, t]);

  // ── Derived ─────────────────────────────────────────────────────────────

  const isCleanEnabled = mode === 'clean' && cleanConfirmText === 'CLEAN INSTALL';
  const canApply = mode !== 'clean' || isCleanEnabled;

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
        aria-label={t('modal.importTitle')}
        className={`modal-enter w-full max-w-[720px] ${mode === 'clean' && step === 2 ? 'shadow-destructive-modal' : 'shadow-modal'}`}
        style={{ background: 'var(--surface)', borderRadius: '12px', padding: '24px' }}
      >
        {/* Title */}
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          {step === 1 ? t('import.title') : step === 2 ? t('import.preview') : 'Import Results'}
        </h2>

        {/* Step indicator */}
        <div className="mt-3 flex gap-2" style={{ marginTop: '12px' }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '3px',
                borderRadius: '9999px',
                background: s <= step ? 'var(--accent)' : 'var(--border-strong)',
                transition: 'background 200ms ease',
              }}
            />
          ))}
        </div>

        {/* ── Step 1: Upload ─────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div
              className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg"
              style={{
                border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border-strong)'}`,
                background: isDragging ? 'var(--accent-subtle)' : 'transparent',
                padding: '40px 24px',
                marginTop: '16px',
                transition: 'border-color 150ms ease, background 150ms ease',
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M16 4v18M8 14l8-8 8 8" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 22v4a2 2 0 002 2h20a2 2 0 002-2v-4" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                {t('import.dropHere')}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                {t('import.selectFile')}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {previewLoading && (
              <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {t('misc.loading')}
              </div>
            )}

            {fileError && (
              <div
                aria-live="polite"
                className="mt-3 rounded-lg"
                style={{ background: 'var(--danger-subtle)', color: 'var(--danger)', padding: '8px 12px', fontSize: '13px', marginTop: '12px' }}
              >
                {fileError}
              </div>
            )}

            {/* Buttons */}
            <div className="mt-4 flex justify-end" style={{ marginTop: '20px' }}>
              <button
                type="button"
                onClick={onClose}
                className="shadow-ring cursor-pointer rounded-lg px-4 py-2"
                style={{ font: '500 14px/1.4 var(--font-sans)', background: 'var(--surface)', color: 'var(--text-primary)', border: 'none' }}
              >
                {t('button.cancel')}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Preview ────────────────────────────────────────────── */}
        {step === 2 && preview && (
          <>
            {/* Counts summary */}
            <div className="mt-4 flex gap-4" style={{ marginTop: '16px' }}>
              {[
                { label: t('import.newItems').replace('{count}', String(preview.totalNew)), color: 'var(--health-ok)' },
                { label: t('import.overwriteItems').replace('{count}', String(preview.totalOverwrite)), color: 'var(--health-warn)' },
                { label: t('import.skipItems').replace('{count}', String(preview.totalSkip)), color: 'var(--text-tertiary)' },
              ].map(({ label, color }) => (
                <div
                  key={label}
                  className="rounded-lg px-3 py-2"
                  style={{ background: 'var(--bg)', fontSize: '13px', color, fontWeight: 500 }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Conflicts list */}
            {preview.items.filter((i) => i.conflictsWith).length > 0 && (
              <div className="mt-3 hide-scrollbar" style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Conflicts
                </span>
                {preview.items
                  .filter((i): i is ImportPreviewItem & { conflictsWith: string } => i.conflictsWith !== null)
                  .map((item) => {
                    const key = `${item.category}:${item.name}`;
                    return (
                      <div key={key} className="mt-2 flex items-center justify-between rounded-md px-3 py-2" style={{ background: 'var(--bg)' }}>
                        <div>
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{item.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>{item.category}</span>
                        </div>
                        <select
                          value={conflictResolutions[key] ?? 'skip'}
                          onChange={(e) => setResolution(key, e.target.value as ConflictResolution)}
                          className="cursor-pointer rounded-md px-2 py-1"
                          style={{
                            font: '400 12px/1.4 var(--font-sans)',
                            background: 'var(--surface)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: '6px',
                          }}
                        >
                          <option value="skip">Skip</option>
                          <option value="overwrite">Overwrite</option>
                        </select>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Mode selection */}
            <div className="mt-4 flex flex-col gap-2" style={{ marginTop: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Import Mode
              </span>
              {([
                { value: 'merge' as const, label: 'Merge', desc: 'Add new items, skip conflicts' },
                { value: 'overwrite' as const, label: 'Merge + Overwrite', desc: 'Add new items, overwrite conflicts' },
                { value: 'clean' as const, label: 'Clean Install', desc: 'Remove all existing items first' },
              ]).map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2"
                  style={{
                    background: mode === opt.value ? 'var(--accent-subtle)' : 'transparent',
                    border: mode === opt.value ? '1px solid var(--accent)' : '1px solid transparent',
                    transition: 'background 150ms ease, border-color 150ms ease',
                  }}
                >
                  <input
                    type="radio"
                    name="importMode"
                    checked={mode === opt.value}
                    onChange={() => setMode(opt.value)}
                    style={{ accentColor: 'var(--accent)', marginTop: '2px' }}
                  />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{opt.label}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'block', marginTop: '2px' }}>{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            {/* Clean install warning */}
            {mode === 'clean' && (
              <div
                className="mt-3 rounded-lg"
                style={{
                  background: 'var(--danger-subtle)',
                  border: '1px solid var(--danger)',
                  padding: '12px',
                  marginTop: '12px',
                }}
              >
                <p style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 500, margin: 0 }}>
                  This will delete ALL existing items before importing. This cannot be undone.
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
                  Type <strong>CLEAN INSTALL</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={cleanConfirmText}
                  onChange={(e) => setCleanConfirmText(e.target.value)}
                  placeholder="CLEAN INSTALL"
                  className="mt-2 w-full rounded-md px-3 py-2"
                  style={{
                    font: '400 13px/1.4 var(--font-mono)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '6px',
                    marginTop: '8px',
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--focus-ring)'; }}
                  onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            )}

            {/* Error */}
            {applyError && (
              <div
                aria-live="polite"
                className="mt-3 rounded-lg"
                style={{ background: 'var(--danger-subtle)', color: 'var(--danger)', padding: '8px 12px', fontSize: '13px', marginTop: '12px' }}
              >
                {applyError}
              </div>
            )}

            {/* Buttons */}
            <div className="mt-4 flex items-center justify-end gap-3" style={{ marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isApplying}
                className="shadow-ring cursor-pointer rounded-lg px-4 py-2"
                style={{ font: '500 14px/1.4 var(--font-sans)', background: 'var(--surface)', color: 'var(--text-primary)', border: 'none' }}
              >
                {t('button.back')}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying || !canApply}
                className="cursor-pointer rounded-lg px-4 py-2"
                style={{
                  font: '500 14px/1.4 var(--font-sans)',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  opacity: isApplying || !canApply ? 0.5 : 1,
                  transition: 'opacity 150ms ease',
                }}
              >
                {isApplying && (
                  <svg className="mr-2 inline-block animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="24" strokeLinecap="round" />
                  </svg>
                )}
                {t('button.apply')}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Results ────────────────────────────────────────────── */}
        {step === 3 && result && (
          <>
            {/* Counts */}
            <div className="mt-4 flex flex-wrap gap-3" style={{ marginTop: '16px' }}>
              {[
                { label: 'Created', count: result.totalCreated, color: 'var(--health-ok)' },
                { label: 'Overwritten', count: result.totalOverwritten, color: 'var(--health-warn)' },
                { label: 'Skipped', count: result.totalSkipped, color: 'var(--text-tertiary)' },
                { label: 'Failed', count: result.totalFailed, color: 'var(--danger)' },
              ].map(({ label, count, color }) => (
                <div
                  key={label}
                  className="rounded-lg px-3 py-2"
                  style={{ background: 'var(--bg)', fontSize: '13px', fontWeight: 500 }}
                >
                  <span style={{ color }}>{count}</span>{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Failed items */}
            {result.results.filter((r) => !r.success).length > 0 && (
              <div className="mt-3 hide-scrollbar" style={{ maxHeight: '160px', overflowY: 'auto', marginTop: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Failed Items
                </span>
                {result.results
                  .filter((r): r is ImportResultItem & { error: string } => !r.success)
                  .map((r) => (
                    <div
                      key={`${r.category}:${r.name}`}
                      className="shadow-error-inset mt-2 rounded-md px-3 py-2"
                      style={{ background: 'var(--bg)' }}
                    >
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--danger)', display: 'block', marginTop: '2px' }}>
                        {r.error}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {/* Backup path */}
            {backupPath && (
              <div
                className="mt-3 rounded-lg"
                style={{
                  background: 'var(--accent-subtle)',
                  padding: '10px 12px',
                  marginTop: '12px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}
              >
                Backup saved to:{' '}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>
                  {backupPath}
                </span>
              </div>
            )}

            {/* Buttons */}
            <div className="mt-4 flex justify-end" style={{ marginTop: '20px' }}>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg px-4 py-2"
                style={{
                  font: '500 14px/1.4 var(--font-sans)',
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                }}
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
