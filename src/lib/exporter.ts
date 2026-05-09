// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Export / Import Logic
// ---------------------------------------------------------------------------

import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

import {
  DashboardItem,
  ExportProfile,
  ExportedAgent,
  ExportedSkill,
  ExportedHook,
  ExportedCommand,
  ExportedRule,
  ExportedMcpServer,
  ExportedPlugin,
  ImportPreviewItem,
  ImportPreviewResponse,
  ImportResultItem,
  ImportApplyResponse,
  ItemCategory,
  ItemScope,
  InventorySummary,
} from './types';
import { safeModifySettings, atomicWriteJson } from './settings-mutex';

// ── Constants ─────────────────────────────────────────────────────────────

const MAX_ITEMS = 500;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const EXPORTABLE_CATEGORIES = new Set<ItemCategory>([
  ItemCategory.AGENT,
  ItemCategory.SKILL,
  ItemCategory.HOOK,
  ItemCategory.COMMAND,
  ItemCategory.RULE,
  ItemCategory.MCP_SERVER,
  ItemCategory.PLUGIN,
]);

// ── Helpers ───────────────────────────────────────────────────────────────

function isLocalSettings(item: DashboardItem): boolean {
  return item.sourceFile.endsWith('settings.local.json');
}

function isExportable(item: DashboardItem): boolean {
  return EXPORTABLE_CATEGORIES.has(item.category);
}

async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function redactEnvValues(env: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!env) return undefined;
  const redacted: Record<string, string> = {};
  for (const key of Object.keys(env)) {
    redacted[key] = '<REDACTED>';
  }
  return redacted;
}

async function buildExportedItem(
  item: DashboardItem,
): Promise<{ category: ItemCategory; data: unknown } | null> {
  const content = await readFileContent(item.filePath);

  switch (item.category) {
    case ItemCategory.AGENT:
      return {
        category: item.category,
        data: {
          name: item.name,
          description: item.description,
          files: [{ relativePath: path.basename(item.filePath), content }],
        } satisfies ExportedAgent,
      };

    case ItemCategory.SKILL:
      return {
        category: item.category,
        data: {
          name: item.name,
          description: item.description,
          files: [{ relativePath: path.basename(item.filePath), content }],
        } satisfies ExportedSkill,
      };

    case ItemCategory.HOOK: {
      const meta = item.metadata ?? {};
      return {
        category: item.category,
        data: {
          event: meta.event ?? item.name,
          command: meta.command ?? '',
          ...(meta.timeout ? { timeout: Number(meta.timeout) } : {}),
        } satisfies ExportedHook,
      };
    }

    case ItemCategory.COMMAND:
      return {
        category: item.category,
        data: {
          name: item.name,
          description: item.description,
          files: [{ relativePath: path.basename(item.filePath), content }],
        } satisfies ExportedCommand,
      };

    case ItemCategory.RULE:
      return {
        category: item.category,
        data: {
          name: item.name,
          content,
          filePath: item.filePath,
        } satisfies ExportedRule,
      };

    case ItemCategory.MCP_SERVER: {
      const meta = item.metadata ?? {};
      const env = meta.env ? JSON.parse(meta.env) as Record<string, string> : undefined;
      return {
        category: item.category,
        data: {
          name: item.name,
          command: meta.command ?? '',
          args: meta.args ? JSON.parse(meta.args) as string[] : [],
          env: redactEnvValues(env),
        } satisfies ExportedMcpServer,
      };
    }

    case ItemCategory.PLUGIN:
      return {
        category: item.category,
        data: {
          name: item.name,
          description: item.description,
          files: [{ relativePath: path.basename(item.filePath), content }],
        } satisfies ExportedPlugin,
      };

    default:
      return null;
  }
}

function emptyProfile(name: string, description: string, scope: ItemScope): ExportProfile {
  return {
    version: 1,
    name,
    description,
    exportedAt: new Date().toISOString(),
    scope,
    agents: [],
    skills: [],
    hooks: [],
    commands: [],
    rules: [],
    mcpServers: [],
    plugins: [],
  };
}

function pushToProfile(profile: ExportProfile, category: ItemCategory, data: unknown): void {
  switch (category) {
    case ItemCategory.AGENT:     profile.agents.push(data as ExportedAgent); break;
    case ItemCategory.SKILL:     profile.skills.push(data as ExportedSkill); break;
    case ItemCategory.HOOK:      profile.hooks.push(data as ExportedHook); break;
    case ItemCategory.COMMAND:   profile.commands.push(data as ExportedCommand); break;
    case ItemCategory.RULE:      profile.rules.push(data as ExportedRule); break;
    case ItemCategory.MCP_SERVER: profile.mcpServers.push(data as ExportedMcpServer); break;
    case ItemCategory.PLUGIN:    profile.plugins.push(data as ExportedPlugin); break;
  }
}

// ── Export ─────────────────────────────────────────────────────────────────

export async function exportAll(
  items: DashboardItem[],
  options: { includeLocalSettings: boolean },
): Promise<ExportProfile> {
  const profile = emptyProfile('full-export', 'Full dashboard export', ItemScope.GLOBAL);

  const eligible = items.filter(
    (item) => isExportable(item) && (options.includeLocalSettings || !isLocalSettings(item)),
  );
  const results = await Promise.all(eligible.map((item) => buildExportedItem(item)));
  for (const result of results) {
    if (result) pushToProfile(profile, result.category, result.data);
  }

  return profile;
}

export async function exportSelected(
  items: DashboardItem[],
  itemIds: string[],
  options: { includeLocalSettings: boolean },
): Promise<ExportProfile> {
  const idSet = new Set(itemIds);
  const profile = emptyProfile('selected-export', 'Selected items export', ItemScope.GLOBAL);

  const eligible = items.filter(
    (item) => idSet.has(item.id) && isExportable(item) && (options.includeLocalSettings || !isLocalSettings(item)),
  );
  const results = await Promise.all(eligible.map((item) => buildExportedItem(item)));
  for (const result of results) {
    if (result) pushToProfile(profile, result.category, result.data);
  }

  return profile;
}

// ── Import Preview ────────────────────────────────────────────────────────

function itemKey(scope: string, category: string, name: string): string {
  return `${scope}:${category}:${name}`.toLowerCase();
}

export async function previewImport(
  profile: ExportProfile,
  existingItems: DashboardItem[],
): Promise<ImportPreviewResponse> {
  const existingKeys = new Map<string, string>();
  for (const item of existingItems) {
    existingKeys.set(itemKey(item.scope, item.category, item.name), item.id);
  }

  const previewItems: ImportPreviewItem[] = [];

  const entries: Array<{ category: ItemCategory; name: string }> = [
    ...profile.agents.map(a => ({ category: ItemCategory.AGENT, name: a.name })),
    ...profile.skills.map(s => ({ category: ItemCategory.SKILL, name: s.name })),
    ...profile.hooks.map(h => ({ category: ItemCategory.HOOK, name: h.event })),
    ...profile.commands.map(c => ({ category: ItemCategory.COMMAND, name: c.name })),
    ...profile.rules.map(r => ({ category: ItemCategory.RULE, name: r.name })),
    ...profile.mcpServers.map(m => ({ category: ItemCategory.MCP_SERVER, name: m.name })),
    ...profile.plugins.map(p => ({ category: ItemCategory.PLUGIN, name: p.name })),
  ];

  for (const entry of entries) {
    const key = itemKey(profile.scope, entry.category, entry.name);
    const existingId = existingKeys.get(key);

    if (existingId) {
      previewItems.push({
        category: entry.category,
        name: entry.name,
        action: 'overwrite',
        conflictsWith: existingId,
      });
    } else {
      previewItems.push({
        category: entry.category,
        name: entry.name,
        action: 'create',
        conflictsWith: null,
      });
    }
  }

  const totalNew = previewItems.filter(i => i.action === 'create').length;
  const totalOverwrite = previewItems.filter(i => i.action === 'overwrite').length;
  const totalSkip = previewItems.filter(i => i.action === 'skip').length;

  return {
    profileName: profile.name,
    description: profile.description,
    items: previewItems,
    totalNew,
    totalOverwrite,
    totalSkip,
  };
}

// ── Import Apply ──────────────────────────────────────────────────────────

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function backupProfile(profile: ExportProfile): Promise<string> {
  const backupDir = path.join(homedir(), '.claude', 'dashboard-backup');
  await ensureDir(backupDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${timestamp}.claude-profile.json`);
  await atomicWriteJson(backupPath, profile);
  return backupPath;
}

async function deleteExistingItems(
  context: { projectPath: string | null; globalPath: string },
): Promise<void> {
  const roots: string[] = [];
  if (context.projectPath) roots.push(path.join(context.projectPath, '.claude'));
  roots.push(context.globalPath);

  for (const root of roots) {
    const dirs = ['agents', 'skills', 'hooks', 'commands', 'rules', 'plugins'];
    for (const dir of dirs) {
      const dirPath = path.join(root, dir);
      try {
        await fs.rm(dirPath, { recursive: true, force: true });
      } catch { /* best-effort */ }
    }

    // Clear hooks and mcpServers from settings.json
    const settingsPath = path.join(root, 'settings.json');
    try {
      await safeModifySettings<Record<string, unknown>>(settingsPath, (data) => {
        delete data.hooks;
        delete data.mcpServers;
        return data;
      });
    } catch { /* best-effort */ }
  }
}

async function writeFileItem(
  basePath: string,
  subDir: string,
  name: string,
  fileName: string,
  content: string,
): Promise<void> {
  const dirPath = path.join(basePath, '.claude', subDir, name);
  await ensureDir(dirPath);
  await fs.writeFile(path.join(dirPath, fileName), content, 'utf-8');
}

export async function applyImport(
  profile: ExportProfile,
  mode: 'merge' | 'overwrite' | 'clean',
  resolutions: Record<string, 'skip' | 'overwrite'>,
  context: { projectPath: string | null; globalPath: string },
): Promise<ImportApplyResponse> {
  // Auto-backup
  await backupProfile(profile);

  if (mode === 'clean') {
    await deleteExistingItems(context);
  }

  const basePath = context.projectPath ?? context.globalPath;
  const claudeDir = context.projectPath
    ? path.join(context.projectPath, '.claude')
    : context.globalPath;

  const results: ImportResultItem[] = [];
  let totalCreated = 0;
  let totalOverwritten = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  const tryApply = async (
    category: ItemCategory,
    name: string,
    apply: () => Promise<void>,
  ): Promise<void> => {
    const key = `${category}:${name}`;
    const resolution = resolutions[key];

    if (mode === 'merge' && resolution === 'skip') {
      results.push({ category, name, success: true, action: 'skipped' });
      totalSkipped++;
      return;
    }

    try {
      await apply();
      const isOverwrite = mode === 'overwrite' || resolution === 'overwrite';
      const action = isOverwrite ? 'overwritten' as const : 'created' as const;
      results.push({ category, name, success: true, action });
      if (action === 'overwritten') totalOverwritten++;
      else totalCreated++;
    } catch (err) {
      results.push({
        category,
        name,
        success: false,
        action: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
      totalFailed++;
    }
  };

  // File-based categories — parallel writes (independent directories)
  await Promise.all([
    // Agents
    ...profile.agents.map((agent) =>
      tryApply(ItemCategory.AGENT, agent.name, async () => {
        const dir = path.join(claudeDir, 'agents');
        await ensureDir(dir);
        const file = agent.files[0];
        await fs.writeFile(path.join(dir, `${agent.name}.md`), file?.content ?? '', 'utf-8');
      }),
    ),
    // Skills
    ...profile.skills.map((skill) =>
      tryApply(ItemCategory.SKILL, skill.name, async () => {
        const dir = path.join(claudeDir, 'skills', skill.name);
        await ensureDir(dir);
        const file = skill.files[0];
        await fs.writeFile(path.join(dir, 'SKILL.md'), file?.content ?? '', 'utf-8');
      }),
    ),
    // Commands
    ...profile.commands.map((cmd) =>
      tryApply(ItemCategory.COMMAND, cmd.name, async () => {
        const dir = path.join(claudeDir, 'commands');
        await ensureDir(dir);
        const file = cmd.files[0];
        await fs.writeFile(path.join(dir, `${cmd.name}.md`), file?.content ?? '', 'utf-8');
      }),
    ),
    // Rules
    ...profile.rules.map((rule) =>
      tryApply(ItemCategory.RULE, rule.name, async () => {
        const dir = path.join(claudeDir, 'rules');
        await ensureDir(dir);
        await fs.writeFile(path.join(dir, `${rule.name}.md`), rule.content, 'utf-8');
      }),
    ),
    // Plugins
    ...profile.plugins.map((plugin) =>
      tryApply(ItemCategory.PLUGIN, plugin.name, async () => {
        const dir = path.join(claudeDir, 'plugins', plugin.name);
        await ensureDir(dir);
        const file = plugin.files[0];
        await fs.writeFile(path.join(dir, path.basename(file?.relativePath ?? 'index.js')), file?.content ?? '', 'utf-8');
      }),
    ),
  ]);

  // Hooks — add to settings.json (sequential — uses safeModifySettings mutex)
  for (const hook of profile.hooks) {
    await tryApply(ItemCategory.HOOK, hook.event, async () => {
      const settingsPath = path.join(claudeDir, 'settings.json');
      await ensureDir(claudeDir);
      try { await fs.access(settingsPath); } catch {
        await atomicWriteJson(settingsPath, {});
      }
      await safeModifySettings<Record<string, unknown>>(settingsPath, (data) => {
        const hooks = (data.hooks ?? {}) as Record<string, unknown[]>;
        const list = hooks[hook.event] ?? [];
        list.push({
          command: hook.command,
          ...(hook.timeout ? { timeout: hook.timeout } : {}),
        });
        hooks[hook.event] = list;
        data.hooks = hooks;
        return data;
      });
    });
  }

  // MCP Servers — add to settings.json, skip REDACTED env values
  for (const server of profile.mcpServers) {
    await tryApply(ItemCategory.MCP_SERVER, server.name, async () => {
      const settingsPath = path.join(claudeDir, 'settings.json');
      await ensureDir(claudeDir);
      try { await fs.access(settingsPath); } catch {
        await atomicWriteJson(settingsPath, {});
      }
      await safeModifySettings<Record<string, unknown>>(settingsPath, (data) => {
        const servers = (data.mcpServers ?? {}) as Record<string, unknown>;
        const env: Record<string, string> = {};
        if (server.env) {
          for (const [k, v] of Object.entries(server.env)) {
            if (v !== '<REDACTED>') env[k] = v;
          }
        }
        servers[server.name] = {
          command: server.command,
          args: server.args,
          ...(Object.keys(env).length > 0 ? { env } : {}),
        };
        data.mcpServers = servers;
        return data;
      });
    });
  }

  return {
    results,
    totalCreated,
    totalOverwritten,
    totalSkipped,
    totalFailed,
    inventory: null,
  };
}

// ── Validation ────────────────────────────────────────────────────────────

function hasDangerousPath(name: string): boolean {
  if (!name) return true;
  if (name.includes('..')) return true;
  if (path.isAbsolute(name)) return true;
  if (name.includes('\0')) return true;
  return false;
}

export function validateProfile(profile: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!profile || typeof profile !== 'object') {
    return { valid: false, errors: ['Profile must be a non-null object'] };
  }

  const p = profile as Record<string, unknown>;

  // Version check
  if (p.version !== 1) {
    errors.push(`Unsupported version: ${p.version}`);
  }

  // Size check (rough estimate)
  const serialized = JSON.stringify(profile);
  if (serialized.length > MAX_SIZE_BYTES) {
    errors.push(`Profile exceeds maximum size of ${MAX_SIZE_BYTES} bytes`);
  }

  // Category keys check
  const requiredKeys = ['agents', 'skills', 'hooks', 'commands', 'rules', 'mcpServers', 'plugins'];
  for (const key of requiredKeys) {
    if (!Array.isArray(p[key])) {
      errors.push(`Missing or invalid category: ${key}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Item count check
  let totalItems = 0;
  for (const key of requiredKeys) {
    totalItems += (p[key] as unknown[]).length;
  }
  if (totalItems > MAX_ITEMS) {
    errors.push(`Too many items: ${totalItems} (max ${MAX_ITEMS})`);
  }

  // Path traversal check on all names / file paths
  const checkNames = (arr: unknown[], label: string) => {
    for (const item of arr) {
      const obj = item as Record<string, unknown>;
      const name = (obj.name ?? obj.event ?? '') as string;
      if (hasDangerousPath(name)) {
        errors.push(`Dangerous path in ${label}: "${name}"`);
      }
      if (Array.isArray(obj.files)) {
        for (const f of obj.files as Array<Record<string, unknown>>) {
          if (hasDangerousPath(f.relativePath as string)) {
            errors.push(`Dangerous file path in ${label}: "${f.relativePath}"`);
          }
        }
      }
    }
  };

  checkNames(p.agents as unknown[], 'agents');
  checkNames(p.skills as unknown[], 'skills');
  checkNames(p.hooks as unknown[], 'hooks');
  checkNames(p.commands as unknown[], 'commands');
  checkNames(p.rules as unknown[], 'rules');
  checkNames(p.mcpServers as unknown[], 'mcpServers');
  checkNames(p.plugins as unknown[], 'plugins');

  return { valid: errors.length === 0, errors };
}
