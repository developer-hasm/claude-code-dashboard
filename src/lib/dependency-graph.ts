// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Dependency Graph Builder
// ---------------------------------------------------------------------------

import fs from 'node:fs/promises';

import {
  DashboardItem,
  DependencyNode,
  DependencyEdge,
  ItemCategory,
} from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  circularRefs: string[][];
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000; // 30 seconds

let cachedGraph: DependencyGraph | null = null;
let cacheTimestamp = 0;

function isCacheValid(): boolean {
  return cachedGraph !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

/** Clear the dependency graph cache (useful for testing). */
export function clearDependencyCache(): void {
  cachedGraph = null;
  cacheTimestamp = 0;
}

// ── File Content Reading ──────────────────────────────────────────────────────

async function readFileContent(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// ── Frontmatter Parsing (lightweight, no dependency) ──────────────────────────

function parseFrontmatter(content: string): Record<string, unknown> {
  if (!content.startsWith('---')) return {};
  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) return {};

  const yaml = content.slice(3, endIdx).trim();
  const result: Record<string, unknown> = {};

  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    // Handle simple YAML list on subsequent lines — collect inline comma-sep
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      result[key] = rawValue
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if (rawValue) {
      result[key] = rawValue.replace(/^["']|["']$/g, '');
    } else {
      // Value may be a multi-line list; peek ahead is complex, store empty.
      result[key] = [];
    }
  }

  return result;
}

/**
 * Parse YAML list values that span multiple lines.
 * Returns strings from `- item` patterns following the given key.
 */
function parseYamlList(content: string, key: string): string[] {
  const lines = content.split('\n');
  const results: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (line.startsWith(`${key}:`)) {
      const inline = line.slice(key.length + 1).trim();
      if (inline.startsWith('[') && inline.endsWith(']')) {
        return inline
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      }
      capturing = true;
      continue;
    }
    if (capturing) {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('- ')) {
        results.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
      } else if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      } else {
        break; // end of list
      }
    }
  }

  return results;
}

// ── Edge Detection ────────────────────────────────────────────────────────────

function buildItemLookup(items: DashboardItem[]): Map<string, DashboardItem> {
  const lookup = new Map<string, DashboardItem>();
  for (const item of items) {
    lookup.set(item.id, item);
    // Also index by name for fuzzy matching
    lookup.set(`name:${item.category}:${item.name}`, item);
  }
  return lookup;
}

function buildCategoryNameLookup(items: DashboardItem[]): Map<string, DashboardItem> {
  const map = new Map<string, DashboardItem>();
  for (const item of items) {
    const key = `${item.category}:${item.name.toLowerCase()}`;
    if (!map.has(key)) map.set(key, item);
    // Also index without .md extension for fuzzy matching
    const noExt = item.name.replace(/\.md$/i, '').toLowerCase();
    const keyNoExt = `${item.category}:${noExt}`;
    if (!map.has(keyNoExt)) map.set(keyNoExt, item);
  }
  return map;
}

function findItemByNameAndCategory(
  _items: DashboardItem[],
  name: string,
  category: ItemCategory,
  lookup?: Map<string, DashboardItem>,
): DashboardItem | undefined {
  if (lookup) {
    const key = `${category}:${name.toLowerCase()}`;
    return lookup.get(key) ?? lookup.get(`${category}:${name.replace(/\.md$/i, '').toLowerCase()}`);
  }
  // Fallback for callers without a lookup map
  return _items.find(
    (i) => i.category === category && (i.name === name || i.name === name.replace(/\.md$/, '')),
  );
}

async function detectEdges(
  items: DashboardItem[],
): Promise<DependencyEdge[]> {
  const edges: DependencyEdge[] = [];
  const seen = new Set<string>();

  const addEdge = (from: string, to: string, type: DependencyEdge['type']) => {
    const key = `${from}->${to}:${type}`;
    if (seen.has(key) || from === to) return;
    seen.add(key);
    edges.push({ from, to, type });
  };

  const lookup = buildCategoryNameLookup(items);
  const agents = items.filter((i) => i.category === ItemCategory.AGENT);
  const skills = items.filter((i) => i.category === ItemCategory.SKILL);
  const hooks = items.filter((i) => i.category === ItemCategory.HOOK);
  const mcpServers = items.filter((i) => i.category === ItemCategory.MCP_SERVER);

  // --- Hook -> Agent: grep .sh content for agent names / subagent_type ---
  for (const hook of hooks) {
    const content = await readFileContent(hook.filePath);
    if (!content) continue;

    for (const agent of agents) {
      const nameNoExt = agent.name.replace(/\.md$/, '');
      const pattern = new RegExp(`\\b(${escapeRegex(agent.name)}|${escapeRegex(nameNoExt)}|subagent_type\\s*[:=]\\s*["']?${escapeRegex(nameNoExt)})`, 'i');
      if (pattern.test(content)) {
        addEdge(hook.id, agent.id, 'triggers');
      }
    }
  }

  // --- Skill -> MCP: grep SKILL.md for mcp__ prefix ---
  for (const skill of skills) {
    const content = await readFileContent(skill.filePath);
    if (!content) continue;

    for (const mcp of mcpServers) {
      const serverName = mcp.metadata.serverName ?? mcp.name;
      const pattern = new RegExp(`mcp__${escapeRegex(serverName)}`, 'i');
      if (pattern.test(content)) {
        addEdge(skill.id, mcp.id, 'uses');
      }
    }

    // --- Skill -> Agent: grep SKILL.md for subagent_type or agent filenames ---
    for (const agent of agents) {
      const nameNoExt = agent.name.replace(/\.md$/, '');
      const pattern = new RegExp(`\\b(subagent_type\\s*[:=]\\s*["']?${escapeRegex(nameNoExt)}|${escapeRegex(agent.name)}|${escapeRegex(nameNoExt)})`, 'i');
      if (pattern.test(content)) {
        addEdge(skill.id, agent.id, 'uses');
      }
    }
  }

  // --- Agent -> Skill: parse frontmatter skills: key ---
  for (const agent of agents) {
    const content = await readFileContent(agent.filePath);
    if (!content) continue;

    const skillNames = parseYamlList(content, 'skills');
    for (const skillName of skillNames) {
      const target = findItemByNameAndCategory(items, skillName, ItemCategory.SKILL, lookup);
      if (target) {
        addEdge(agent.id, target.id, 'uses');
      }
    }

    // --- Agent -> MCP: parse frontmatter mcpServers: key ---
    const mcpNames = parseYamlList(content, 'mcpServers');
    for (const mcpName of mcpNames) {
      const target = findItemByNameAndCategory(items, mcpName, ItemCategory.MCP_SERVER, lookup);
      if (target) {
        addEdge(agent.id, target.id, 'requires');
      }
    }

    // --- Agent -> Agent: parse content for subagent_type references ---
    for (const otherAgent of agents) {
      if (otherAgent.id === agent.id) continue;
      const nameNoExt = otherAgent.name.replace(/\.md$/, '');
      const pattern = new RegExp(`subagent_type\\s*[:=]\\s*["']?${escapeRegex(nameNoExt)}`, 'i');
      if (pattern.test(content)) {
        addEdge(agent.id, otherAgent.id, 'uses');
      }
    }
  }

  return edges;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Circular Reference Detection (DFS) ───────────────────────────────────────

function detectCircularRefs(
  nodes: DependencyNode[],
  edges: DependencyEdge[],
): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(nodeId: string, path: string[]): void {
    if (stack.has(nodeId)) {
      // Found a cycle — extract it from the path.
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), nodeId]);
      }
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    stack.add(nodeId);
    path.push(nodeId);

    const neighbors = adjacency.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      dfs(neighbor, path);
    }

    path.pop();
    stack.delete(nodeId);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }

  return cycles;
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Build a dependency graph from the given dashboard items.
 * Results are cached with a 30-second TTL.
 */
export async function buildDependencyGraph(
  items: DashboardItem[],
): Promise<DependencyGraph> {
  if (isCacheValid()) {
    return cachedGraph!;
  }

  // Filter out sessions and config — they have no dependency relationships.
  const relevant = items.filter(
    (i) => i.category !== ItemCategory.SESSION && i.category !== ItemCategory.CONFIG,
  );

  // Build nodes.
  const nodes: DependencyNode[] = relevant.map((item) => ({
    id: item.id,
    category: item.category,
    name: item.name,
    scope: item.scope,
  }));

  // Detect edges by reading file contents and scanning for references.
  const edges = await detectEdges(relevant);

  // Detect circular references.
  const circularRefs = detectCircularRefs(nodes, edges);

  const graph: DependencyGraph = { nodes, edges, circularRefs };

  // Cache the result.
  cachedGraph = graph;
  cacheTimestamp = Date.now();

  return graph;
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Find all items that depend on the given item.
 * Useful for showing warnings in the DeleteModal.
 */
export function getDependentsOf(
  itemId: string,
  graph: DependencyGraph,
): DependencyNode[] {
  const dependentIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.to === itemId) {
      dependentIds.add(edge.from);
    }
  }
  return graph.nodes.filter((n) => dependentIds.has(n.id));
}
