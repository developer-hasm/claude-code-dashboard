'use client';

export interface WarningBannerProps {
  message: string;
  onDismiss?: () => void;
}

export default function WarningBanner({ message, onDismiss }: WarningBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2"
      style={{
        background: 'var(--warn-bg)',
        borderBottom: '1px solid var(--warn-border)',
        color: 'var(--warn-text)',
        padding: '8px 16px',
        font: '400 14px/1.5 var(--font-sans)',
      }}
    >
      {/* Triangle warning icon */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
        <path
          d="M8 2L14.5 13.5H1.5L8 2z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          fill="none"
        />
        <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="8" cy="11.2" r="0.7" fill="currentColor" />
      </svg>

      <span className="flex-1">{message}</span>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 cursor-pointer rounded p-1"
          style={{ color: 'var(--warn-text)', background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
