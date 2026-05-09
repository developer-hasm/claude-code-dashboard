'use client';

import { useI18n, type Locale } from '@/lib/i18n';

// ── Component ─────────────────────────────────────────────────────────────

export default function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  const locales: { key: Locale; label: string }[] = [
    { key: 'en', label: 'EN' },
    { key: 'ko', label: 'KO' },
  ];

  return (
    <div className="flex" style={{ gap: '2px' }}>
      {locales.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => setLocale(key)}
          className="cursor-pointer"
          style={{
            font: '500 12px/1 var(--font-sans)',
            padding: '4px 8px',
            borderRadius: '9999px',
            border: 'none',
            background: locale === key ? 'var(--accent-subtle)' : 'transparent',
            color: locale === key ? 'var(--accent)' : 'var(--text-secondary)',
            transition: 'background 150ms ease, color 150ms ease',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
