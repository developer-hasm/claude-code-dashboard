'use client';

import { useCallback, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────

export interface McpTool {
  name: string;
  description: string;
  enabled: boolean;
}

export interface McpToolToggleProps {
  serverName: string;
  tools: McpTool[];
  csrfToken: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function McpToolToggle({ serverName, tools: initialTools, csrfToken }: McpToolToggleProps) {
  const [tools, setTools] = useState(initialTools);
  const [loadingTool, setLoadingTool] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);

  const handleToggle = useCallback(
    async (toolName: string, currentEnabled: boolean) => {
      setLoadingTool(toolName);
      setTooltip(null);
      try {
        const res = await fetch(`/api/mcp/${encodeURIComponent(serverName)}/tools/${encodeURIComponent(toolName)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${csrfToken}` },
          body: JSON.stringify({ enabled: !currentEnabled }),
        });
        if (res.status === 501) {
          setTooltip(toolName);
          setTimeout(() => setTooltip(null), 2000);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setTools((prev) =>
          prev.map((t) => (t.name === toolName ? { ...t, enabled: !currentEnabled } : t)),
        );
      } catch {
        // Silently fail; toggle stays in previous state
      } finally {
        setLoadingTool(null);
      }
    },
    [serverName, csrfToken],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {tools.map((tool) => {
        const isLoading = loadingTool === tool.name;
        const showTooltip = tooltip === tool.name;

        return (
          <div
            key={tool.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {/* Tool info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {tool.name}
              </div>
              {tool.description && (
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tool.description}
                </div>
              )}
            </div>

            {/* Toggle + tooltip */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                role="switch"
                aria-checked={tool.enabled}
                aria-label={`Toggle ${tool.name}`}
                disabled={isLoading}
                onClick={() => handleToggle(tool.name, tool.enabled)}
                className={`toggle-track${tool.enabled ? ' on' : ''}`}
                style={{
                  border: 'none',
                  opacity: isLoading ? 0.5 : 1,
                  cursor: isLoading ? 'wait' : 'pointer',
                }}
              >
                <span className="toggle-thumb" />
              </button>

              {/* "Coming soon" tooltip */}
              {showTooltip && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 6px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--text-primary)',
                    color: 'var(--surface)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    font: '400 12px/1.4 var(--font-sans)',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                  }}
                >
                  Coming soon
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
