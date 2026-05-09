'use client';

export function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar skeleton (desktop) */}
      <aside
        className="sidebar-border hidden md:flex"
        style={{
          width: 208,
          flexShrink: 0,
          flexDirection: 'column',
          gap: 8,
          padding: '20px 14px',
          background: 'var(--surface)',
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 28, borderRadius: 'var(--radius-md)' }}
          />
        ))}
      </aside>

      {/* Main content skeleton */}
      <main style={{ flex: 1, padding: 24, maxWidth: 960, margin: '0 auto', width: '100%' }}>
        {/* Search bar skeleton */}
        <div
          className="skeleton"
          style={{ height: 40, borderRadius: 'var(--radius-lg)', marginBottom: 20 }}
        />

        {/* Card skeletons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{
                height: 100,
                borderRadius: 'var(--radius-lg)',
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
