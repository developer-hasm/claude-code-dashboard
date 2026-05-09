'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DashboardItem, InventorySummary, ItemCategory } from '@/lib/types';
import { ItemScope } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/components/Providers';
import { Sidebar } from '@/components/Sidebar';
import { SearchBar } from '@/components/SearchBar';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import ItemCard from '@/components/ItemCard';
import DeleteModal from '@/components/DeleteModal';
import SessionList from '@/components/SessionList';
import OverviewDashboard from '@/components/OverviewDashboard';
import ExportModal from '@/components/ExportModal';
import ImportModal from '@/components/ImportModal';

// ── Helpers ───────────────────────────────────────────────────────────────

type SelectedCategory = ItemCategory | 'all' | 'overview';

const VERSION = '1.0.0';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const CATEGORY_ORDER: ItemCategory[] = [
  'plugin', 'agent', 'skill', 'hook', 'command', 'mcp_server', 'rule',
] as ItemCategory[];

// ── Main Page ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();

  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardItem | null>(null);
  const [deleteDependents, setDeleteDependents] = useState<string[]>([]); // items that depend on this
  const [deleteDependencies, setDeleteDependencies] = useState<string[]>([]); // items this depends on
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [, setTick] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch helpers ──

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory');
      const json = await res.json();
      if (json.result === true && json.data) {
        setInventory(json.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError(json.message || t('error.loadFailed'));
      }
    } catch {
      setError(t('error.networkError'));
    }
  }, [t]);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch('/api/token');
      const json = await res.json();
      if (json.result && json.data?.token) {
        setCsrfToken(json.data.token);
      }
    } catch {
      // non-fatal
    }
  }, []);

  // ── Init ──

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchToken(), fetchInventory()]);
      setIsLoading(false);
    })();
  }, [fetchToken, fetchInventory]);

  // ── Polling (30s, paused when tab hidden) ──

  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(fetchInventory, 30_000);
  }, [fetchInventory]);

  useEffect(() => {
    startPolling();

    const onVisibility = () => {
      if (document.hidden) {
        if (pollingRef.current) clearInterval(pollingRef.current);
      } else {
        fetchInventory();
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchInventory, startPolling]);

  // Tick for "Xs ago" display
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  // ── Delete (with dependency check) ──

  const requestDelete = useCallback(async (item: DashboardItem) => {
    setDeleteTarget(item);
    setDeleteDependents([]);
    setDeleteDependencies([]);
    try {
      const res = await fetch('/api/dependencies');
      const json = await res.json();
      if (json.result && json.data?.edges) {
        const edges = json.data.edges as { from: string; to: string }[];
        const getName = (id: string) => id.split(':').pop() ?? id;
        // Items that depend on this (will break if deleted)
        setDeleteDependents(
          edges.filter((e) => e.to === item.id).map((e) => getName(e.from))
        );
        // Items this depends on (references that will be lost)
        setDeleteDependencies(
          edges.filter((e) => e.from === item.id).map((e) => getName(e.to))
        );
      }
    } catch { /* non-fatal */ }
  }, []);

  const handleDelete = useCallback(async (item: DashboardItem) => {
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${csrfToken}`,
        },
      });
      const json = await res.json();
      if (json.result === true && json.data) {
        setInventory(json.data.inventory);
        setLastUpdated(new Date());
        startPolling();
      } else {
        throw new Error(json.message || 'Delete failed');
      }
      setDeleteTarget(null);
    } catch (err) {
      throw err; // Let DeleteModal display the error
    }
  }, [csrfToken, startPolling]);

  // ── Filtering & sorting (memoized) ──

  const filteredItems = useMemo(() => {
    if (!inventory) return [];
    let items = [...inventory.items];
    if (selectedCategory !== 'all' && selectedCategory !== 'overview') {
      items = items.filter((i) => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
      );
    }
    items.sort((a, b) => {
      // 1. Last used DESC (used > unused, recent first)
      const aUsed = String(a.metadata.lastUsed || '');
      const bUsed = String(b.metadata.lastUsed || '');
      if (aUsed !== bUsed) return bUsed.localeCompare(aUsed);
      // 2. Created DESC
      const aCreated = String(a.metadata.createdAt || '');
      const bCreated = String(b.metadata.createdAt || '');
      if (aCreated !== bCreated) return bCreated.localeCompare(aCreated);
      // 3. Name ASC
      return a.name.localeCompare(b.name);
    });
    return items;
  }, [inventory, selectedCategory, searchQuery]);

  // ── Render ──

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>
        <button
          onClick={() => { setError(null); setIsLoading(true); fetchInventory().finally(() => setIsLoading(false)); }}
          style={{
            padding: '8px 20px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--primary)',
            color: 'var(--surface)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {t('button.refresh')}
        </button>
      </div>
    );
  }

  const counts = inventory
    ? inventory.counts
    : ({} as Record<ItemCategory, number>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ── Header ── */}
      <header
        className="shadow-ring"
        style={{
          background: 'var(--surface)',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Claude Code Dashboard</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-subtle)',
              color: 'var(--accent)',
            }}
          >
            v{VERSION}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {timeAgo(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => fetchInventory()}
            title={t('button.refresh')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'light')}
            title="Toggle theme"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {theme === 'dark' ? (
                <circle cx="12" cy="12" r="5" />
              ) : (
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              )}
            </svg>
          </button>
          <button
            onClick={() => setLocale(locale === 'en' ? 'ko' : 'en')}
            style={{
              background: 'var(--surface)',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
            }}
            className="shadow-ring"
          >
            {locale === 'en' ? 'KO' : 'EN'}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          counts={counts}
          totalCount={inventory?.totalCount ?? 0}
        />

        <main className="hide-scrollbar" style={{ flex: 1, padding: 24, maxWidth: 960, margin: '0 auto', width: '100%', overflowY: 'auto' }}>
          {selectedCategory === 'overview' && inventory ? (
            <OverviewDashboard
              inventory={inventory}
              csrfToken={csrfToken}
              onExport={() => setShowExport(true)}
              onImport={() => setShowImport(true)}
            />
          ) : selectedCategory === 'session' ? (
            <>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                totalCount={counts['session' as ItemCategory] ?? 0}
                filteredCount={filteredItems.length}
              />
              <SessionList
                items={filteredItems}
                csrfToken={csrfToken}
                onDelete={() => fetchInventory()}
              />
            </>
          ) : (
            <>
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                totalCount={
                  selectedCategory === 'all'
                    ? inventory?.totalCount ?? 0
                    : counts[selectedCategory as ItemCategory] ?? 0
                }
                filteredCount={filteredItems.length}
              />
              {filteredItems.length === 0 ? (
                <EmptyState
                  category={searchQuery ? 'search' : (selectedCategory as ItemCategory)}
                  searchQuery={searchQuery || undefined}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                  {filteredItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onDelete={requestDelete}
                      hideCategoryBadge={selectedCategory !== 'all' && selectedCategory !== 'overview'}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Delete Modal ── */}
      <DeleteModal
        item={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteDependents([]); setDeleteDependencies([]); }}
        dependents={deleteDependents}
        dependencies={deleteDependencies}
      />

      {inventory && (
        <ExportModal
          isOpen={showExport}
          onClose={() => setShowExport(false)}
          inventory={inventory}
          csrfToken={csrfToken}
        />
      )}

      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        csrfToken={csrfToken}
        onImportComplete={() => fetchInventory()}
      />

    </div>
  );
}
