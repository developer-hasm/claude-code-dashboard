'use client';

import { useState } from 'react';
import type { InventorySummary, ProjectType, ItemCategory } from '@/lib/types';
import CategoryBadge from './CategoryBadge';

export interface WorkspaceRecommendationProps {
  inventory: InventorySummary;
}

interface RecommendedEntry {
  name: string;
  category: ItemCategory;
  reason: string;
  priority: 'essential' | 'recommended' | 'optional';
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  essential: { bg: 'var(--danger-subtle)', text: 'var(--danger)' },
  recommended: { bg: 'var(--accent-subtle)', text: 'var(--accent)' },
  optional: { bg: 'var(--border-strong)', text: 'var(--text-tertiary)' },
};

/** Simple project type detection from projectPath. */
function detectProjectType(projectPath: string | null): ProjectType {
  if (!projectPath) return 'unknown';
  const p = projectPath.toLowerCase();
  if (p.includes('next')) return 'nextjs';
  if (p.includes('react')) return 'react';
  if (p.includes('vue')) return 'vue';
  if (p.includes('svelte')) return 'svelte';
  if (p.includes('python') || p.includes('.py')) return 'python';
  if (p.includes('cargo') || p.includes('rust')) return 'rust';
  if (p.includes('go.mod') || p.includes('golang')) return 'go';
  return 'node';
}

/** Universal recommendations — language agnostic */
const RECOMMENDATIONS: RecommendedEntry[] = [
  { name: 'fullstack-webapp', category: 'skill' as ItemCategory, reason: 'Full-stack development orchestrator', priority: 'essential' },
  { name: 'research-assistant', category: 'skill' as ItemCategory, reason: 'Deep research with 5 specialized agents', priority: 'essential' },
  { name: 'review-loop', category: 'skill' as ItemCategory, reason: 'Automated code review loop (3 reviewers)', priority: 'essential' },
  { name: 'architect', category: 'agent' as ItemCategory, reason: 'System design and architecture', priority: 'recommended' },
  { name: 'qa-engineer', category: 'agent' as ItemCategory, reason: 'Test strategy and quality assurance', priority: 'recommended' },
  { name: 'frontend-dev', category: 'agent' as ItemCategory, reason: 'Frontend UI development', priority: 'recommended' },
  { name: 'backend-dev', category: 'agent' as ItemCategory, reason: 'Backend API development', priority: 'recommended' },
  { name: 'devops-engineer', category: 'agent' as ItemCategory, reason: 'CI/CD and infrastructure', priority: 'optional' },
  { name: 'api-security-checklist', category: 'skill' as ItemCategory, reason: 'OWASP Top 10 security checklist', priority: 'optional' },
  { name: 'component-patterns', category: 'skill' as ItemCategory, reason: 'React/Next.js component patterns', priority: 'optional' },
];

export default function WorkspaceRecommendation({ inventory }: WorkspaceRecommendationProps) {
  const [open, setOpen] = useState(true);

  const recommendations = RECOMMENDATIONS;

  const existingNames = new Set(inventory.items.map((i) => i.name.toLowerCase()));

  return (
    <div
      className="shadow-ring"
      style={{
        background: 'var(--surface)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>Workspace Recommendations</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
            color: 'var(--text-tertiary)',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: '0 20px 16px' }}>
          {(() => {
            const notInstalled = recommendations.filter(r => !existingNames.has(r.name.toLowerCase()));
            if (notInstalled.length === 0) return (
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                All recommended items are already installed.
              </span>
            );
            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notInstalled.map((rec) => {
                const priorityStyle = PRIORITY_STYLES[rec.priority];
                return (
                  <div
                    key={rec.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                          {rec.name}
                        </span>
                        <CategoryBadge category={rec.category} />
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: '9999px',
                            fontSize: 10,
                            fontWeight: 600,
                            background: priorityStyle.bg,
                            color: priorityStyle.text,
                            textTransform: 'uppercase',
                          }}
                        >
                          {rec.priority}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                        {rec.reason}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
