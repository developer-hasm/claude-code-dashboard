'use client';

import { useRef, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
}

export function SearchBar({ value, onChange, totalCount, filteredCount }: SearchBarProps) {
  const { t } = useI18n();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      // Update input immediately for responsiveness
      if (inputRef.current) inputRef.current.value = v;
      // Debounce the state update
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(v), 200);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange('');
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  }, [onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        className="shadow-ring focus-within:shadow-focus"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: '8px 12px',
          transition: 'box-shadow 150ms ease',
        }}
      >
        {/* Search icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          defaultValue={value}
          onChange={handleChange}
          placeholder={t('misc.search')}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 14,
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}
        />
        {/* Clear button */}
        {value && (
          <button
            onClick={handleClear}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: 2,
              borderRadius: 'var(--radius-sm)',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingLeft: 2 }}>
        Showing {filteredCount} of {totalCount} items
      </span>
    </div>
  );
}
