// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Core Scanning Engine
// ---------------------------------------------------------------------------

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import matter from 'gray-matter';
import {
  DashboardItem,
  ItemCategory,
  ItemScope,
  InventorySummary,
  HealthStatus,
} from './types';
import { expandEnvVars, normalizePath } from './context';
import { getLastUsed } from './usage-db';

// ── In-memory cache ───────────────────────────────────────────────────────

const CACHE_TTL_MS = 5_000;
let cache: { data: InventorySummary; timestamp: number } | null = null;

export function invalidateCache(): void {
  cache = null;
}

// ── Parse warnings ────────────────────────────────────────────────────────

export let parseWarnings: string[] = [];

function warn(msg: string): void {
  parseWarnings.push(msg);
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    console.warn(`[scanner] ${msg}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function generateItemId(scope: ItemScope, category: ItemCategory, name: string): string {
  return `${scope}:${category}:${name}`;
}

function hashSuffix(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 6);
}

async function readSettingsFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

interface FileDates {
  mtime: string;
  birthtime: string;
}

async function safeStat(filePath: string): Promise<string> {
  try {
    const stat = await fs.stat(filePath);
    return stat.mtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function safeStatFull(filePath: string): Promise<FileDates> {
  try {
    const stat = await fs.stat(filePath);
    return {
      mtime: stat.mtime.toISOString(),
      birthtime: stat.birthtime.toISOString(),
    };
  } catch {
    const now = new Date().toISOString();
    return { mtime: now, birthtime: now };
  }
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

function cleanName(filename: string): string {
  const noExt = filename.replace(/\.md$/i, '');
  return noExt.replace(/^\d+\./, '');
}

// Generic markdown file scanner (for agents, commands, rules)
async function scanMarkdownFiles(
  dir: string,
  scope: ItemScope,
  category: ItemCategory,
): Promise<DashboardItem[]> {
  const entries = await safeReaddir(dir);
  const mdFiles = entries.filter(f => f.endsWith('.md'));

  const results = await Promise.all(mdFiles.map(async (file): Promise<DashboardItem | null> => {
    try {
      const filePath = path.join(dir, file);
      const [raw, dates] = await Promise.all([
        fs.readFile(filePath, 'utf-8'),
        safeStatFull(filePath),
      ]);
      let frontmatter: Record<string, unknown> = {};
      let content = raw;

      try {
        const parsed = matter(raw);
        frontmatter = (parsed.data ?? {}) as Record<string, unknown>;
        content = parsed.content;
      } catch {
        warn(`Malformed frontmatter in ${filePath}`);
      }

      const name = (frontmatter.name as string) || cleanName(file);
      const description =
        (frontmatter.description as string) ??
        firstContentLine(content) ??
        null;

      return {
        id: generateItemId(scope, category, name),
        category,
        scope,
        name,
        description,
        filePath: normalizePath(filePath),
        sourceFile: normalizePath(filePath),
        lastModified: dates.mtime,
        metadata: {
          ...extractStringMetadata(frontmatter),
          createdAt: dates.birthtime,
        },
      };
    } catch {
      warn(`Failed to read ${path.join(dir, file)}`);
      return null;
    }
  }));

  return results.filter((r): r is DashboardItem => r !== null);
}

function firstContentLine(content: string): string | null {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) return trimmed;
  }
  return null;
}

function extractStringMetadata(obj: Record<string, unknown>): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && typeof v !== 'object') {
      meta[k] = String(v);
    }
  }
  return meta;
}

function dedup(items: DashboardItem[]): DashboardItem[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const count = (seen.get(item.id) ?? 0) + 1;
    seen.set(item.id, count);
    if (count > 1) {
      const suffix = hashSuffix(item.filePath);
      return { ...item, id: `${item.id}#${suffix}`, name: `${item.name}#${suffix}` };
    }
    return item;
  });
}

// ── Health check ──────────────────────────────────────────────────────────

function checkHealth(item: DashboardItem): HealthStatus {
  try {
    switch (item.category) {
      case ItemCategory.HOOK: {
        const cmd = item.metadata.command ?? item.metadata.rawCommand;
        if (!cmd) return HealthStatus.WARNING;
        const firstToken = cmd.split(/\s+/)[0];
        if (path.isAbsolute(firstToken) && !existsSync(firstToken)) {
          return HealthStatus.ERROR;
        }
        return HealthStatus.HEALTHY;
      }
      case ItemCategory.SKILL: {
        return existsSync(item.filePath) ? HealthStatus.HEALTHY : HealthStatus.ERROR;
      }
      case ItemCategory.PLUGIN: {
        const installPath = item.metadata.installPath;
        if (installPath && !existsSync(installPath)) return HealthStatus.ERROR;
        return HealthStatus.HEALTHY;
      }
      case ItemCategory.AGENT: {
        return existsSync(item.filePath) ? HealthStatus.HEALTHY : HealthStatus.ERROR;
      }
      case ItemCategory.MCP_SERVER: {
        if (item.metadata.authStatus === 'needs-auth') return HealthStatus.WARNING;
        return HealthStatus.HEALTHY;
      }
      default:
        return HealthStatus.UNKNOWN;
    }
  } catch {
    return HealthStatus.UNKNOWN;
  }
}

// ── Settings file path helpers ────────────────────────────────────────────

function settingsPaths(projectPath: string | null, globalPath: string) {
  const files: { path: string; scope: ItemScope }[] = [];
  if (projectPath) {
    files.push({ path: path.join(projectPath, '.claude', 'settings.json'), scope: ItemScope.PROJECT });
    files.push({ path: path.join(projectPath, '.claude', 'settings.local.json'), scope: ItemScope.PROJECT });
  }
  files.push({ path: path.join(globalPath, 'settings.json'), scope: ItemScope.GLOBAL });
  files.push({ path: path.join(globalPath, 'settings.local.json'), scope: ItemScope.GLOBAL });
  return files;
}

// ── Per-category scanners ─────────────────────────────────────────────────

async function scanAgents(
  projectPath: string | null,
  globalPath: string,
): Promise<DashboardItem[]> {
  const items: DashboardItem[] = [];
  const dirs: { dir: string; scope: ItemScope }[] = [];

  if (projectPath) {
    dirs.push({ dir: path.join(projectPath, '.claude', 'agents'), scope: ItemScope.PROJECT });
  }
  dirs.push({ dir: path.join(globalPath, 'agents'), scope: ItemScope.GLOBAL });

  for (const { dir, scope } of dirs) {
    try {
      const scanned = await scanMarkdownFiles(dir, scope, ItemCategory.AGENT);
      for (const item of scanned) {
        item.metadata.health = checkHealth(item);
      }
      items.push(...scanned);
    } catch {
      // directory doesn't exist — skip
    }
  }

  return dedup(items);
}

async function scanSkills(
  projectPath: string | null,
  globalPath: string,
): Promise<DashboardItem[]> {
  const items: DashboardItem[] = [];
  const dirs: { dir: string; scope: ItemScope }[] = [];

  if (projectPath) {
    dirs.push({ dir: path.join(projectPath, '.claude', 'skills'), scope: ItemScope.PROJECT });
  }
  dirs.push({ dir: path.join(globalPath, 'skills'), scope: ItemScope.GLOBAL });

  for (const { dir, scope } of dirs) {
    const entries = await safeReaddir(dir);
    const results = await Promise.all(entries.map(async (entry): Promise<DashboardItem | null> => {
      try {
        const skillDir = path.join(dir, entry);
        const stat = await fs.stat(skillDir);
        if (!stat.isDirectory()) return null;

        // Case-insensitive search for SKILL.md / skill.md
        const subFiles = await safeReaddir(skillDir);
        const skillFile = subFiles.find(f => f.toLowerCase() === 'skill.md');
        if (!skillFile) return null;

        const filePath = path.join(skillDir, skillFile);
        const [raw, dates] = await Promise.all([
          fs.readFile(filePath, 'utf-8'),
          safeStatFull(filePath),
        ]);
        const lastModified = dates.mtime;
        let frontmatter: Record<string, unknown> = {};

        try {
          const parsed = matter(raw);
          frontmatter = (parsed.data ?? {}) as Record<string, unknown>;
        } catch {
          warn(`Malformed frontmatter in ${filePath}`);
        }

        const name = entry;
        const description = (frontmatter.description as string)
          ?? firstContentLine(raw)
          ?? null;
        return {
          id: generateItemId(scope, ItemCategory.SKILL, name),
          category: ItemCategory.SKILL,
          scope,
          name,
          description,
          filePath: normalizePath(filePath),
          sourceFile: normalizePath(filePath),
          lastModified,
          metadata: {
            ...extractStringMetadata(frontmatter),
            createdAt: dates.birthtime,
            health: checkHealth({
              filePath,
              category: ItemCategory.SKILL,
            } as DashboardItem),
          },
        };
      } catch {
        warn(`Failed to scan skill directory: ${entry}`);
        return null;
      }
    }));
    items.push(...results.filter((r): r is DashboardItem => r !== null));
  }

  return dedup(items);
}

/** Read first comment line from a shell script as description */
async function readHookDescription(commandPath: string): Promise<string | null> {
  try {
    // Extract file path from command (may have args after it)
    const scriptPath = commandPath.split(/\s+/)[0];
    const content = await fs.readFile(scriptPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip shebang and empty lines
      if (trimmed.startsWith('#!') || !trimmed) continue;
      // First comment line = description
      if (trimmed.startsWith('#')) {
        return trimmed.replace(/^#\s*/, '');
      }
      break; // Non-comment line reached
    }
  } catch { /* file not readable */ }
  return null;
}

async function scanHooks(
  projectPath: string | null,
  globalPath: string,
): Promise<DashboardItem[]> {
  const items: DashboardItem[] = [];
  const files = settingsPaths(projectPath, globalPath);

  for (const { path: filePath, scope } of files) {
    try {
      const data = await readSettingsFile(filePath);
      if (!data || !data.hooks) continue;

      const lastModified = await safeStat(filePath);
      const hooks = data.hooks as Record<string, unknown>;
      for (const [event, groups] of Object.entries(hooks)) {
        if (!Array.isArray(groups)) continue;
        for (const group of groups) {
          const g = group as { matcher?: string; hooks?: unknown[] };
          const hookList = g.hooks;
          if (!Array.isArray(hookList)) continue;

          for (const hook of hookList) {
            const h = hook as { command?: string; timeout?: number };
            if (!h.command) continue;

            const expanded = expandEnvVars(h.command, projectPath);
            const basename = path.basename(expanded.split(/\s+/)[0]);
            const name = `${event}/${basename}`;

            const item: DashboardItem = {
              id: generateItemId(scope, ItemCategory.HOOK, name),
              category: ItemCategory.HOOK,
              scope,
              name,
              description: await readHookDescription(expanded) ?? `${event} hook`,
              filePath: normalizePath(filePath),
              sourceFile: normalizePath(filePath),
              lastModified,
              metadata: {
                event,
                command: expanded,
                rawCommand: h.command,
                createdAt: lastModified,
                ...(g.matcher ? { matcher: g.matcher } : {}),
                ...(h.timeout != null ? { timeout: String(h.timeout) } : {}),
              },
            };
            item.metadata.health = checkHealth(item);
            items.push(item);
          }
        }
      }
    } catch {
      warn(`Failed to scan hooks from ${filePath}`);
    }
  }

  return dedup(items);
}

async function scanCommands(
  projectPath: string | null,
  globalPath: string,
): Promise<DashboardItem[]> {
  const items: DashboardItem[] = [];
  const dirs: { dir: string; scope: ItemScope }[] = [];

  if (projectPath) {
    dirs.push({ dir: path.join(projectPath, '.claude', 'commands'), scope: ItemScope.PROJECT });
  }
  dirs.push({ dir: path.join(globalPath, 'commands'), scope: ItemScope.GLOBAL });

  for (const { dir, scope } of dirs) {
    const scanned = await scanMarkdownFiles(dir, scope, ItemCategory.COMMAND);
    items.push(...scanned);
  }

  return dedup(items);
}

async function scanPlugins(
  globalPath: string,
  currentProjectPath: string | null,
): Promise<DashboardItem[]> {
  const items: DashboardItem[] = [];
  const pluginsFile = path.join(globalPath, 'plugins', 'installed_plugins.json');

  try {
    const data = await readSettingsFile(pluginsFile);
    if (!data || !data.plugins) return items;

    // Load enabled plugins from all settings files for cross-reference
    const enabledSet = new Set<string>();
    const settingsFiles = [
      path.join(globalPath, 'settings.json'),
      ...(currentProjectPath ? [path.join(currentProjectPath, '.claude', 'settings.json')] : []),
    ];
    for (const sf of settingsFiles) {
      const s = await readSettingsFile(sf);
      if (s?.enabledPlugins && typeof s.enabledPlugins === 'object') {
        for (const [k, v] of Object.entries(s.enabledPlugins as Record<string, boolean>)) {
          if (v) enabledSet.add(k);
        }
      }
    }

    const plugins = data.plugins as Record<string, unknown[]>;
    const lastModified = await safeStat(pluginsFile);

    for (const [key, entries] of Object.entries(plugins)) {
      if (!Array.isArray(entries)) continue;

      for (const entry of entries) {
        const e = entry as Record<string, unknown>;
        const entryScope = e.scope as string | undefined;

        let scope: ItemScope;
        if (entryScope === 'project') {
          // Only show project-scoped plugins if they match the current project
          if (!currentProjectPath) continue;
          const projectDir = e.projectDir as string | undefined;
          if (projectDir && normalizePath(projectDir) !== normalizePath(currentProjectPath)) {
            continue;
          }
          scope = ItemScope.PROJECT;
        } else {
          scope = ItemScope.GLOBAL;
        }

        const name = (e.name as string) || key;
        let description = (e.description as string) ?? null;
        const installPath = (e.installPath as string) ?? '';

        // Try to read description from marketplace plugin.json if not in installed_plugins.json
        if (!description) {
          const pluginName = key.split('@')[0];
          const marketplace = key.split('@')[1] || 'claude-plugins-official';
          const manifestPath = path.join(
            globalPath, 'plugins', 'marketplaces', marketplace, 'plugins', pluginName,
            '.claude-plugin', 'plugin.json',
          );
          try {
            const manifest = await readSettingsFile(manifestPath);
            if (manifest?.description) {
              description = manifest.description as string;
            }
          } catch { /* no manifest */ }
        }

        const item: DashboardItem = {
          id: generateItemId(scope, ItemCategory.PLUGIN, name),
          category: ItemCategory.PLUGIN,
          scope,
          name,
          description,
          filePath: normalizePath(installPath || pluginsFile),
          sourceFile: normalizePath(pluginsFile),
          lastModified,
          metadata: {
            key,
            ...(installPath ? { installPath: normalizePath(installPath) } : {}),
            enabled: String(enabledSet.size === 0 || enabledSet.has(key) || enabledSet.has(name)),
            createdAt: (e.installedAt as string) ?? lastModified,
          },
        };
        item.metadata.health = checkHealth(item);
        items.push(item);
      }
    }
  } catch {
    warn(`Failed to scan plugins from ${pluginsFile}`);
  }

  return dedup(items);
}

async function scanMcpServers(
  _projectPath: string | null,
  _globalPath: string,
): Promise<DashboardItem[]> {
  const items: DashboardItem[] = [];

  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync('claude mcp list', {
      timeout: 15_000,
      encoding: 'utf-8',
    });

    // Parse output lines like:
    // claude.ai Notion: https://mcp.notion.com/mcp - ✓ Connected
    // claude.ai Slack: https://mcp.slack.com/mcp - ! Needs authentication
    // github: https://api.githubcopilot.com/mcp/ (HTTP) - ✗ Failed to connect
    // my-server: /path/to/cmd (stdio) - ✓ Connected
    const lines = stdout.split('\n').filter(l => l.includes(': '));

    for (const line of lines) {
      // Skip header line
      if (line.startsWith('Checking')) continue;

      // Match: name: url/command [(TYPE)] - status
      // URL/command is non-whitespace; optional (TYPE) annotation; then " - status"
      const match = line.match(/^(.+?):\s+(\S+)(?:\s+\([^)]+\))?\s*-\s*(.+)$/);
      if (!match) continue;

      const name = match[1].trim();
      const url = match[2].trim();
      const statusRaw = match[3].trim();

      const connected = statusRaw.includes('Connected');
      const needsAuth = statusRaw.includes('Needs authentication');
      const failed = statusRaw.includes('Failed');
      const authStatus = connected ? 'connected' : needsAuth ? 'needs-auth' : failed ? 'failed' : 'unknown';
      const health = connected
        ? HealthStatus.HEALTHY
        : needsAuth
          ? HealthStatus.WARNING
          : failed
            ? HealthStatus.ERROR
            : HealthStatus.UNKNOWN;

      items.push({
        id: generateItemId(ItemScope.GLOBAL, ItemCategory.MCP_SERVER, name),
        category: ItemCategory.MCP_SERVER,
        scope: ItemScope.GLOBAL,
        name,
        description: url,
        filePath: '',
        sourceFile: '',
        lastModified: new Date().toISOString(),
        metadata: {
          url,
          authStatus,
          status: statusRaw,
          health,
        },
      });
    }
  } catch {
    warn('Failed to scan MCP servers via `claude mcp list`');
  }

  return items;
}

async function scanRules(
  projectPath: string | null,
  globalPath: string,
): Promise<DashboardItem[]> {
  const items: DashboardItem[] = [];
  const dirs: { dir: string; scope: ItemScope }[] = [];

  if (projectPath) {
    dirs.push({ dir: path.join(projectPath, '.claude', 'rules'), scope: ItemScope.PROJECT });
  }
  dirs.push({ dir: path.join(globalPath, 'rules'), scope: ItemScope.GLOBAL });

  for (const { dir, scope } of dirs) {
    const scanned = await scanMarkdownFiles(dir, scope, ItemCategory.RULE);
    items.push(...scanned);
  }

  return dedup(items);
}

async function scanSessions(
  globalPath: string,
  projectPath: string | null,
): Promise<DashboardItem[]> {
  const items: DashboardItem[] = [];
  const sessionsDir = path.join(globalPath, 'sessions');
  const entries = await safeReaddir(sessionsDir);
  const jsonFiles = entries.filter(f => f.endsWith('.json'));

  const sessionResults = await Promise.all(jsonFiles.map(async (file): Promise<DashboardItem | null> => {
    try {
      const filePath = path.join(sessionsDir, file);
      const raw = await fs.readFile(filePath, 'utf-8');
      if (!raw.trim()) return null;

      const data = JSON.parse(raw) as Record<string, unknown>;
      const sessionId = (data.sessionId as string) ?? file.replace(/\.json$/, '');
      const cwd = (data.cwd as string) ?? '';
      const kind = (data.kind as string) ?? 'interactive';
      const pid = data.pid != null ? String(data.pid) : '';
      const entrypoint = (data.entrypoint as string) ?? '';
      const startedAt = (data.startedAt as string) ?? '';

      const scope =
        projectPath && cwd && normalizePath(cwd).startsWith(normalizePath(projectPath))
          ? ItemScope.PROJECT
          : ItemScope.GLOBAL;

      const name = sessionId;

      // Find matching JSONL file(s) in projects directory
      let firstPrompt = '';
      let messageCount = 0;
      let toolCallCount = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let lastInputTokens = 0;
      let firstMessageAt = '';
      let lastMessageAt = '';
      let jsonlSize = 0;

      try {
        const projectsDirPath = path.join(globalPath, 'projects');
        const projDirs = await safeReaddir(projectsDirPath);

        for (const projDir of projDirs) {
          const jsonlPath = path.join(projectsDirPath, projDir, `${sessionId}.jsonl`);
          try {
            const stat = await fs.stat(jsonlPath);
            jsonlSize += stat.size;
            const content = await fs.readFile(jsonlPath, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim());

            for (const line of lines) {
              try {
                const msg = JSON.parse(line);

                // Track timestamps
                const ts = msg.timestamp as string | undefined;
                if (ts && (msg.type === 'user' || msg.type === 'assistant')) {
                  if (!firstMessageAt) firstMessageAt = ts;
                  lastMessageAt = ts;
                }

                // First user prompt: type=user, message.role=user
                if (!firstPrompt && msg.type === 'user' && msg.message?.role === 'user') {
                  messageCount++;
                  const c = msg.message.content;
                  const text = typeof c === 'string' ? c
                    : Array.isArray(c) ? c.find((b: { type: string; text?: string }) => b.type === 'text')?.text ?? '' : '';
                  // Strip XML tags like <scheduled-task...> for cleaner display
                  const clean = text.replace(/<[^>]+>/g, '').trim();
                  if (clean) firstPrompt = clean.slice(0, 200);
                }

                // Assistant messages — count only if has text content
                if (msg.type === 'assistant') {
                  const content = msg.message?.content;
                  let hasText = false;
                  if (Array.isArray(content)) {
                    for (const block of content) {
                      if (block.type === 'text' && block.text?.trim()) hasText = true;
                      if (block.type === 'tool_use') toolCallCount++;
                    }
                  } else if (typeof content === 'string' && content.trim()) {
                    hasText = true;
                  }
                  if (hasText) messageCount++;
                  const usage = msg.message?.usage ?? msg.usage;
                  if (usage) {
                    const msgInput = (usage.input_tokens ?? 0)
                      + (usage.cache_read_input_tokens ?? 0)
                      + (usage.cache_creation_input_tokens ?? 0);
                    totalInputTokens += msgInput;
                    totalOutputTokens += (usage.output_tokens ?? 0);
                    // Track the latest message's input_tokens = current context window
                    lastInputTokens = msgInput;
                  }
                }
              } catch { /* skip malformed line */ }
            }
            break; // found the JSONL, no need to check other project dirs
          } catch { /* JSONL not in this project dir */ }
        }
      } catch { /* projects dir may not exist */ }

      const jsonFileSize = Buffer.byteLength(raw, 'utf-8');
      const totalSize = jsonFileSize + jsonlSize;
      const description = firstPrompt
        ? firstPrompt.slice(0, 100) + (firstPrompt.length > 100 ? '...' : '')
        : `${kind} session`;

      return {
        id: generateItemId(scope, ItemCategory.SESSION, name),
        category: ItemCategory.SESSION,
        scope,
        name,
        description,
        filePath: normalizePath(filePath),
        sourceFile: normalizePath(filePath),
        lastModified: startedAt || (await safeStat(filePath)),
        metadata: {
          ...(pid ? { pid } : {}),
          sessionId,
          ...(cwd ? { cwd } : {}),
          kind,
          ...(entrypoint ? { entrypoint } : {}),
          ...(startedAt ? { startedAt } : {}),
          createdAt: startedAt || '',
          ...(firstPrompt ? { firstPrompt } : {}),
          ...(firstMessageAt ? { firstMessageAt } : {}),
          ...(lastMessageAt ? { lastMessageAt } : {}),
          messageCount: String(messageCount),
          toolCallCount: String(toolCallCount),
          inputTokens: String(totalInputTokens),
          outputTokens: String(totalOutputTokens),
          totalTokens: String(totalInputTokens + totalOutputTokens),
          diskSize: String(totalSize),
          lastInputTokens: String(lastInputTokens),
          contextSaturation: lastInputTokens > 0
            ? String(Math.min(100, Math.round((lastInputTokens / 1_000_000) * 100)))
            : '0',
        },
      };
    } catch {
      warn(`Failed to read session file: ${file}`);
      return null;
    }
  }));

  items.push(...sessionResults.filter((r): r is DashboardItem => r !== null));

  return dedup(items);
}

async function scanConfig(
  projectPath: string | null,
  globalPath: string,
): Promise<DashboardItem[]> {
  const items: DashboardItem[] = [];
  const files = settingsPaths(projectPath, globalPath);

  for (const { path: filePath, scope } of files) {
    try {
      const data = await readSettingsFile(filePath);
      if (!data) continue;

      const keyCount = Object.keys(data).length;
      const lastModified = await safeStat(filePath);
      const basename = path.basename(filePath);
      const isLocal = basename.includes('.local.');
      const configType = isLocal ? 'settings.local' : 'settings';

      items.push({
        id: generateItemId(scope, ItemCategory.CONFIG, `${configType}(${scope})`),
        category: ItemCategory.CONFIG,
        scope,
        name: `${configType}(${scope})`,
        description: `${keyCount} key(s) configured`,
        filePath: normalizePath(filePath),
        sourceFile: normalizePath(filePath),
        lastModified,
        metadata: {
          configType,
          scope,
          keyCount: String(keyCount),
          createdAt: lastModified,
        },
      });
    } catch {
      warn(`Failed to scan config: ${filePath}`);
    }
  }

  // stats-cache.json
  try {
    const statsPath = path.join(globalPath, 'stats-cache.json');
    const data = await readSettingsFile(statsPath);
    if (data) {
      items.push({
        id: generateItemId(ItemScope.GLOBAL, ItemCategory.CONFIG, 'stats-cache'),
        category: ItemCategory.CONFIG,
        scope: ItemScope.GLOBAL,
        name: 'stats-cache',
        description: `Stats cache with ${Object.keys(data).length} entries`,
        filePath: normalizePath(statsPath),
        sourceFile: normalizePath(statsPath),
        lastModified: await safeStat(statsPath),
        metadata: {
          configType: 'stats-cache',
          scope: ItemScope.GLOBAL,
          keyCount: String(Object.keys(data).length),
        },
      });
    }
  } catch { /* ignore */ }

  return items;
}

// ── Main scan orchestrator ────────────────────────────────────────────────


export async function scanAll(
  projectPath: string | null,
  globalPath: string,
): Promise<InventorySummary> {
  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  // Reset warnings
  parseWarnings = [];

  // Run all 9 scanners in parallel
  const [
    agents,
    skills,
    hooks,
    commands,
    plugins,
    mcpServers,
    rules,
    sessions,
    config,
  ] = await Promise.all([
    scanAgents(projectPath, globalPath).catch(() => [] as DashboardItem[]),
    scanSkills(projectPath, globalPath).catch(() => [] as DashboardItem[]),
    scanHooks(projectPath, globalPath).catch(() => [] as DashboardItem[]),
    scanCommands(projectPath, globalPath).catch(() => [] as DashboardItem[]),
    scanPlugins(globalPath, projectPath).catch(() => [] as DashboardItem[]),
    scanMcpServers(projectPath, globalPath).catch(() => [] as DashboardItem[]),
    scanRules(projectPath, globalPath).catch(() => [] as DashboardItem[]),
    scanSessions(globalPath, projectPath).catch(() => [] as DashboardItem[]),
    scanConfig(projectPath, globalPath).catch(() => [] as DashboardItem[]),
  ]);

  const allItems = [
    ...agents,
    ...skills,
    ...hooks,
    ...commands,
    ...plugins,
    ...mcpServers,
    ...rules,
    ...sessions,
    ...config,
  ];

  // Enrich with last-used dates from SQLite
  try {
    const lastUsed = getLastUsed(); // returns Map<string, string>
    for (const item of allItems) {
      const usedDate = lastUsed.get(item.name) || lastUsed.get(item.name.replace(/\.md$/, ''));
      if (usedDate) {
        item.metadata.lastUsed = usedDate;
      }
    }
  } catch { /* non-fatal */ }

  const counts = {} as Record<ItemCategory, number>;
  for (const cat of Object.values(ItemCategory)) {
    counts[cat] = 0;
  }
  for (const item of allItems) {
    counts[item.category]++;
  }

  const summary: InventorySummary = {
    totalCount: allItems.length,
    counts,
    items: allItems,
    scannedAt: new Date().toISOString(),
    projectPath,
    globalPath,
  };

  cache = { data: summary, timestamp: Date.now() };
  return summary;
}
