'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import SessionConversationModal from './SessionConversationModal';

interface Hit {
  sessionId: string;
  matchedTimestamp: string;
  snippet: string; // contains <mark> tags from FTS5
  rank: number;
}

interface SearchResponse {
  result: boolean;
  data?: {
    query: string;
    hits: Hit[];
  };
}

const DEBOUNCE_MS = 250;

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Render snippet HTML safely. The API returns server-controlled <mark>...</mark>
 * tags from SQLite FTS5's snippet() function — never user input — so we render
 * directly. We still escape any incidental angle brackets in the original
 * content_preview before <mark> tags are inserted (FTS5 doesn't auto-escape),
 * so this is essentially HTML over user-controlled text. To be safe, sanitize
 * by allowing only <mark> tags.
 */
function sanitizeSnippet(snippet: string): string {
  // Strategy: escape everything, then re-introduce <mark> as the only allowed tag.
  const escaped = snippet
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/&lt;mark&gt;/g, '<mark>')
    .replace(/&lt;\/mark&gt;/g, '</mark>');
}

export default function SessionFullTextSearch() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  // Debounce input
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!debounced) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/sessions/search?q=${encodeURIComponent(debounced)}&limit=30`);
        const json = (await res.json()) as SearchResponse;
        if (!cancelled) setHits(json.data?.hits ?? []);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debounced]);

  // Group hits by sessionId so we don't show 10 rows for the same session.
  const grouped = useMemo(() => {
    const bySession = new Map<string, Hit[]>();
    for (const h of hits) {
      const arr = bySession.get(h.sessionId) ?? [];
      arr.push(h);
      bySession.set(h.sessionId, arr);
    }
    // Order sessions by best (lowest) rank of their hits
    return Array.from(bySession.entries())
      .map(([sid, arr]) => ({
        sessionId: sid,
        bestRank: Math.min(...arr.map(a => a.rank)),
        hits: arr.slice(0, 3),
      }))
      .sort((a, b) => a.bestRank - b.bestRank);
  }, [hits]);

  return (
    <div
      className="shadow-ring"
      style={{ background: 'var(--surface)', borderRadius: 8, padding: 16, marginBottom: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: query ? 12 : 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
          🔍 {t('sessionSearch.title')}
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('sessionSearch.placeholder')}
          style={{
            flex: 1,
            padding: '6px 10px',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            fontSize: 13,
            background: 'var(--bg)',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {query && (
        <>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('misc.loading')}
            </div>
          ) : grouped.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('sessionSearch.noHits')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {t('sessionSearch.resultCount').replace('{count}', String(grouped.length))}
              </div>
              {grouped.map((group) => (
                <button
                  key={group.sessionId}
                  type="button"
                  onClick={() => setOpenSessionId(group.sessionId)}
                  style={{
                    textAlign: 'left',
                    padding: 10,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {group.sessionId.slice(0, 8)}…  ·  {formatTime(group.hits[0].matchedTimestamp)}
                  </div>
                  {group.hits.map((h, i) => (
                    <div
                      key={i}
                      style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}
                      dangerouslySetInnerHTML={{ __html: sanitizeSnippet(h.snippet) }}
                    />
                  ))}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <SessionConversationModal sessionId={openSessionId} onClose={() => setOpenSessionId(null)} />
    </div>
  );
}
