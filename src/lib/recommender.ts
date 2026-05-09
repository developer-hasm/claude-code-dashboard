// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Project Type Detection & Recommendations
// ---------------------------------------------------------------------------

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  DashboardItem,
  ItemCategory,
  ProjectType,
  RecommendedItem,
  RequiredItem,
} from './types';

// ── Project Type Detection ────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function anyExists(root: string, patterns: string[]): Promise<boolean> {
  for (const p of patterns) {
    if (await fileExists(path.join(root, p))) return true;
  }
  return false;
}

export async function detectProjectType(projectPath: string): Promise<ProjectType> {
  const hasPackageJson = await fileExists(path.join(projectPath, 'package.json'));
  const hasTsConfig = await fileExists(path.join(projectPath, 'tsconfig.json'));

  // Frontend framework detection
  const hasNext = await anyExists(projectPath, ['next.config.js', 'next.config.ts', 'next.config.mjs']);
  const hasVite = await anyExists(projectPath, ['vite.config.js', 'vite.config.ts', 'vite.config.mjs']);
  const hasNuxt = await anyExists(projectPath, ['nuxt.config.js', 'nuxt.config.ts']);
  const hasAngular = await fileExists(path.join(projectPath, 'angular.json'));
  const hasSvelte = await anyExists(projectPath, ['svelte.config.js', 'svelte.config.ts']);
  const hasVue = hasNuxt || await anyExists(projectPath, ['vue.config.js']);

  // Backend detection
  const hasPython = await anyExists(projectPath, ['requirements.txt', 'pyproject.toml', 'setup.py']);
  const hasGo = await fileExists(path.join(projectPath, 'go.mod'));
  const hasRust = await fileExists(path.join(projectPath, 'Cargo.toml'));

  const isFrontend = hasPackageJson && (hasNext || hasVite || hasNuxt || hasAngular || hasSvelte || hasVue);
  const isBackend = hasPython || hasGo || hasRust || (hasPackageJson && hasTsConfig && !isFrontend);

  // Specific types
  if (hasNext) return 'nextjs';
  if (hasSvelte) return 'svelte';
  if (hasVue || hasNuxt) return 'vue';
  if (hasVite && hasPackageJson) return 'react'; // Vite commonly used with React
  if (hasRust) return 'rust';
  if (hasGo) return 'go';
  if (hasPython) return 'python';
  if (hasPackageJson && hasTsConfig) return 'node';
  if (hasPackageJson) return 'node';

  return 'unknown';
}

// ── Recommendations ───────────────────────────────────────────────────────

type Priority = 'essential' | 'recommended' | 'optional';

interface RecommendationDef {
  category: ItemCategory;
  name: string;
  reason: string;
  priority: Priority;
  installCommand?: string;
}

const RECOMMENDATIONS: Record<ProjectType, RecommendationDef[]> = {
  nextjs: [
    { category: ItemCategory.HOOK, name: 'lint-on-save', reason: 'Auto-lint on file save with ESLint', priority: 'essential' },
    { category: ItemCategory.HOOK, name: 'type-check', reason: 'Run TypeScript type checking before commit', priority: 'essential' },
    { category: ItemCategory.MCP_SERVER, name: 'nextjs-docs', reason: 'Next.js documentation server for up-to-date API reference', priority: 'recommended' },
    { category: ItemCategory.RULE, name: 'nextjs-conventions', reason: 'App Router conventions and best practices', priority: 'recommended' },
    { category: ItemCategory.AGENT, name: 'frontend-dev', reason: 'Frontend development agent for React/Next.js', priority: 'optional' },
    { category: ItemCategory.SKILL, name: 'component-patterns', reason: 'React component design patterns', priority: 'optional' },
  ],
  react: [
    { category: ItemCategory.HOOK, name: 'lint-on-save', reason: 'Auto-lint on file save with ESLint', priority: 'essential' },
    { category: ItemCategory.HOOK, name: 'type-check', reason: 'Run TypeScript type checking before commit', priority: 'recommended' },
    { category: ItemCategory.RULE, name: 'react-conventions', reason: 'React component conventions and hooks best practices', priority: 'recommended' },
    { category: ItemCategory.AGENT, name: 'frontend-dev', reason: 'Frontend development agent', priority: 'optional' },
    { category: ItemCategory.SKILL, name: 'component-patterns', reason: 'React component design patterns', priority: 'optional' },
  ],
  vue: [
    { category: ItemCategory.HOOK, name: 'lint-on-save', reason: 'Auto-lint on file save with ESLint + Vue plugin', priority: 'essential' },
    { category: ItemCategory.RULE, name: 'vue-conventions', reason: 'Vue 3 Composition API conventions', priority: 'recommended' },
    { category: ItemCategory.AGENT, name: 'frontend-dev', reason: 'Frontend development agent', priority: 'optional' },
  ],
  svelte: [
    { category: ItemCategory.HOOK, name: 'lint-on-save', reason: 'Auto-lint on file save', priority: 'essential' },
    { category: ItemCategory.RULE, name: 'svelte-conventions', reason: 'Svelte/SvelteKit conventions', priority: 'recommended' },
  ],
  node: [
    { category: ItemCategory.HOOK, name: 'lint-on-save', reason: 'Auto-lint on file save with ESLint', priority: 'essential' },
    { category: ItemCategory.HOOK, name: 'type-check', reason: 'Run TypeScript type checking', priority: 'essential' },
    { category: ItemCategory.RULE, name: 'node-conventions', reason: 'Node.js project conventions', priority: 'recommended' },
    { category: ItemCategory.SKILL, name: 'api-security-checklist', reason: 'OWASP API security checklist', priority: 'recommended' },
    { category: ItemCategory.AGENT, name: 'backend-dev', reason: 'Backend development agent', priority: 'optional' },
  ],
  python: [
    { category: ItemCategory.HOOK, name: 'format-on-save', reason: 'Auto-format with Black/Ruff on save', priority: 'essential' },
    { category: ItemCategory.HOOK, name: 'type-check', reason: 'Run mypy/pyright type checking', priority: 'recommended' },
    { category: ItemCategory.RULE, name: 'python-conventions', reason: 'Python project conventions and typing', priority: 'recommended' },
    { category: ItemCategory.MCP_SERVER, name: 'python-docs', reason: 'Python documentation server', priority: 'optional' },
  ],
  rust: [
    { category: ItemCategory.HOOK, name: 'cargo-check', reason: 'Run cargo check on save', priority: 'essential' },
    { category: ItemCategory.HOOK, name: 'cargo-clippy', reason: 'Run cargo clippy for linting', priority: 'recommended' },
    { category: ItemCategory.RULE, name: 'rust-conventions', reason: 'Rust idioms and ownership patterns', priority: 'recommended' },
  ],
  go: [
    { category: ItemCategory.HOOK, name: 'go-vet', reason: 'Run go vet on save', priority: 'essential' },
    { category: ItemCategory.HOOK, name: 'go-fmt', reason: 'Auto-format with gofmt', priority: 'essential' },
    { category: ItemCategory.RULE, name: 'go-conventions', reason: 'Go project conventions and error handling', priority: 'recommended' },
  ],
  unknown: [
    { category: ItemCategory.RULE, name: 'general-conventions', reason: 'General coding conventions', priority: 'optional' },
  ],
};

export function getRecommendations(projectType: ProjectType): RecommendedItem[] {
  const defs = RECOMMENDATIONS[projectType] ?? RECOMMENDATIONS.unknown;
  return defs.map(d => ({
    category: d.category,
    name: d.name,
    reason: `[${d.priority}] ${d.reason}`,
    installCommand: d.installCommand,
  }));
}

// ── Required Items Check ──────────────────────────────────────────────────

interface RequiredItemConfig {
  category: string;
  name: string;
  reason: string;
  event?: string; // for hooks
}

export async function checkRequiredItems(
  projectPath: string,
  items: DashboardItem[],
): Promise<{ missing: RequiredItem[]; present: RequiredItem[] }> {
  const configPath = path.join(projectPath, '.claude', 'required-items.json');

  let requiredConfigs: RequiredItemConfig[];
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { missing: [], present: [] };
    requiredConfigs = parsed as RequiredItemConfig[];
  } catch {
    return { missing: [], present: [] };
  }

  const missing: RequiredItem[] = [];
  const present: RequiredItem[] = [];

  for (const req of requiredConfigs) {
    const categoryLower = req.category.toLowerCase();
    const nameLower = req.name.toLowerCase();

    const found = items.some(item => {
      if (item.category.toLowerCase() !== categoryLower) return false;
      if (item.name.toLowerCase() !== nameLower) return false;

      // For hooks, also match event if specified
      if (req.event && item.metadata?.event) {
        return item.metadata.event.toLowerCase() === req.event.toLowerCase();
      }

      return true;
    });

    const entry: RequiredItem = {
      category: req.category as ItemCategory,
      name: req.name,
      reason: req.reason ?? '',
      installed: found,
    };

    if (found) {
      present.push(entry);
    } else {
      missing.push(entry);
    }
  }

  return { missing, present };
}
