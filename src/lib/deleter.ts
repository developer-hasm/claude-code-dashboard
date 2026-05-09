// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Deletion Logic with Soft-Delete (Trash)
// ---------------------------------------------------------------------------

import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

import {
  DashboardItem,
  DeleteResult,
  InventorySummary,
  ItemCategory,
} from './types';
import { validatePath } from './security';
import { safeModifySettings } from './settings-mutex';

// ── Constants ─────────────────────────────────────────────────────────────────

const TRASH_DIR = path.join(homedir(), '.claude', 'dashboard-trash');
const DEFAULT_MAX_AGE_MS = 86_400_000; // 24 hours
const SKILL_FILE_SAFETY_LIMIT = 100;

// ── Trash Management ──────────────────────────────────────────────────────────

/**
 * Ensure the trash directory exists.
 */
export async function ensureTrashDir(): Promise<string> {
  await fs.mkdir(TRASH_DIR, { recursive: true });
  return TRASH_DIR;
}

/**
 * Format a timestamp for use in trash directory names.
 * Output format: `20260406-060000`
 */
function formatTrashTimestamp(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}${mo}${d}-${h}${mi}${s}`;
}

/**
 * Copy a file into the trash directory under a timestamped subfolder.
 * Returns the full path of the trashed copy.
 */
export async function copyToTrash(filePath: string): Promise<string> {
  await ensureTrashDir();
  const timestamp = formatTrashTimestamp(new Date());
  const destDir = path.join(TRASH_DIR, timestamp);
  await fs.mkdir(destDir, { recursive: true });

  const basename = path.basename(filePath);
  const destPath = path.join(destDir, basename);
  await fs.copyFile(filePath, destPath);
  return destPath;
}

/**
 * Purge trash entries older than `maxAgeMs` (default 24 h).
 * Age is determined by the directory's mtime.
 */
export async function purgeStaleTrash(maxAgeMs: number = DEFAULT_MAX_AGE_MS): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(TRASH_DIR);
  } catch {
    // Trash dir does not exist yet — nothing to purge.
    return;
  }

  const now = Date.now();

  await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(TRASH_DIR, entry);
    try {
      const stat = await fs.stat(entryPath);
      if (!stat.isDirectory()) return;
      if (now - stat.mtimeMs > maxAgeMs) {
        await fs.rm(entryPath, { recursive: true, force: true });
      }
    } catch {
      // Skip entries that disappear between readdir and stat.
    }
  }));
}

// ── Mtime Validation ──────────────────────────────────────────────────────────

/**
 * Verify the file's current mtime matches the cached `lastModified` value on
 * the DashboardItem.  This guards against deleting a file that has been
 * modified since the inventory was last scanned.
 */
async function validateMtime(item: DashboardItem): Promise<void> {
  const stat = await fs.stat(item.filePath);
  const fsMtime = stat.mtime.toISOString();
  if (fsMtime !== item.lastModified) {
    throw new Error(
      `Mtime mismatch for ${item.filePath}: expected ${item.lastModified}, ` +
      `got ${fsMtime}.  The file may have been modified since the last scan.`,
    );
  }
}

// ── Per-category Helpers ──────────────────────────────────────────────────────

async function deleteAgentCommandRule(item: DashboardItem): Promise<{ deletedFiles: string[]; trashedTo: string | null; settingsModified: boolean }> {
  const trashedTo = await copyToTrash(item.filePath);
  await fs.unlink(item.filePath);
  return { deletedFiles: [item.filePath], trashedTo, settingsModified: false };
}

async function deleteSkill(item: DashboardItem): Promise<{ deletedFiles: string[]; trashedTo: string | null; settingsModified: boolean }> {
  // The item filePath points to SKILL.md; the parent directory is the skill dir.
  const skillDir = path.dirname(item.filePath);
  const trashedTo = await copyToTrash(item.filePath);

  // Safety check: refuse to recursively delete if the directory contains too
  // many files (prevents accidental data loss from a misconfigured path).
  const files = await fs.readdir(skillDir, { recursive: true });
  if (files.length > SKILL_FILE_SAFETY_LIMIT) {
    throw new Error(
      `Skill directory ${skillDir} contains ${files.length} files, ` +
      `which exceeds the safety limit of ${SKILL_FILE_SAFETY_LIMIT}.  ` +
      `Refusing to delete.`,
    );
  }

  await fs.rm(skillDir, { recursive: true, force: true });
  return { deletedFiles: [skillDir], trashedTo, settingsModified: false };
}

async function deleteHook(item: DashboardItem): Promise<{ deletedFiles: string[]; trashedTo: string | null; settingsModified: boolean }> {
  const deletedFiles: string[] = [];
  let trashedTo: string | null = null;

  // The hook's script file (e.g. .sh) is at `filePath`.  It may or may not exist.
  try {
    await fs.access(item.filePath);
    trashedTo = await copyToTrash(item.filePath);
    deletedFiles.push(item.filePath);
    await fs.unlink(item.filePath);
  } catch {
    // Script file does not exist on disk — that's acceptable.
  }

  // Remove hook entry from settings.json (sourceFile).
  // Hook metadata should contain "event" and "command".
  const hookEvent = item.metadata.event;
  const hookCommand = item.metadata.command ?? item.name;

  if (!item.sourceFile) {
    throw new Error('Hook item is missing sourceFile — cannot modify settings.');
  }

  interface HookEntry {
    type?: string;
    command: string;
    timeout?: number;
  }

  interface HookGroup {
    matcher?: string;
    hooks: HookEntry[];
  }

  interface SettingsJson {
    hooks?: Record<string, HookGroup[]>;
    [key: string]: unknown;
  }

  await safeModifySettings<SettingsJson>(item.sourceFile, (data) => {
    if (!data.hooks || !hookEvent) return data;

    const eventGroups = data.hooks[hookEvent];
    if (!Array.isArray(eventGroups)) return data;

    for (let gi = eventGroups.length - 1; gi >= 0; gi--) {
      const group = eventGroups[gi];
      if (!Array.isArray(group.hooks)) continue;

      group.hooks = group.hooks.filter((h) => h.command !== hookCommand);

      if (group.hooks.length === 0) {
        eventGroups.splice(gi, 1);
      }
    }

    if (eventGroups.length === 0) {
      delete data.hooks[hookEvent];
    }

    // If no events remain, remove hooks entirely.
    if (Object.keys(data.hooks).length === 0) {
      delete data.hooks;
    }

    return data;
  });

  return { deletedFiles, trashedTo, settingsModified: true };
}

async function deletePlugin(item: DashboardItem): Promise<{ deletedFiles: string[]; trashedTo: string | null; settingsModified: boolean }> {
  const deletedFiles: string[] = [];
  let trashedTo: string | null = null;

  // Trash the metadata file (filePath).
  try {
    await fs.access(item.filePath);
    trashedTo = await copyToTrash(item.filePath);
    deletedFiles.push(item.filePath);
  } catch {
    // Metadata file missing — continue anyway.
  }

  // The installed_plugins.json is the sourceFile.
  const pluginKey = item.metadata.key ?? item.name;
  const pluginScope = item.metadata.scope;
  const pluginProjectPath = item.metadata.projectPath;

  interface PluginEntry {
    scope?: string;
    projectPath?: string;
    [key: string]: unknown;
  }

  interface InstalledPluginsJson {
    plugins?: Record<string, PluginEntry[]>;
    [key: string]: unknown;
  }

  let remainingEntries = 0;

  if (item.sourceFile) {
    await safeModifySettings<InstalledPluginsJson>(item.sourceFile, (data) => {
      if (!data.plugins || !data.plugins[pluginKey]) return data;

      data.plugins[pluginKey] = data.plugins[pluginKey].filter((entry) => {
        const scopeMatch = !pluginScope || entry.scope === pluginScope;
        const projectMatch = !pluginProjectPath || entry.projectPath === pluginProjectPath;
        return !(scopeMatch && projectMatch);
      });

      remainingEntries = data.plugins[pluginKey].length;

      if (data.plugins[pluginKey].length === 0) {
        delete data.plugins[pluginKey];
      }

      if (Object.keys(data.plugins).length === 0) {
        delete data.plugins;
      }

      return data;
    });
  }

  // Remove from enabledPlugins in settings.json ONLY if no remaining entries.
  if (remainingEntries === 0) {
    const settingsPath = item.metadata.settingsPath;
    if (settingsPath) {
      interface SettingsJson {
        enabledPlugins?: string[];
        [key: string]: unknown;
      }

      try {
        await safeModifySettings<SettingsJson>(settingsPath, (data) => {
          if (!Array.isArray(data.enabledPlugins)) return data;
          data.enabledPlugins = data.enabledPlugins.filter((p) => p !== pluginKey);
          if (data.enabledPlugins.length === 0) {
            delete data.enabledPlugins;
          }
          return data;
        });
      } catch {
        // settings.json may not exist or not have enabledPlugins — acceptable.
      }
    }
  }

  // Delete cache directory at installPath.
  const installPath = item.metadata.installPath;
  if (installPath) {
    try {
      await fs.rm(installPath, { recursive: true, force: true });
      deletedFiles.push(installPath);
    } catch {
      // Cache dir missing — acceptable.
    }
  }

  return { deletedFiles, trashedTo, settingsModified: true };
}

async function deleteMcpServer(item: DashboardItem): Promise<{ deletedFiles: string[]; trashedTo: string | null; settingsModified: boolean }> {
  if (!item.sourceFile) {
    throw new Error('MCP Server item is missing sourceFile — cannot modify settings.');
  }

  const serverName = item.metadata.serverName ?? item.name;

  interface SettingsJson {
    mcpServers?: Record<string, unknown>;
    [key: string]: unknown;
  }

  await safeModifySettings<SettingsJson>(item.sourceFile, (data) => {
    if (!data.mcpServers) return data;
    delete data.mcpServers[serverName];
    if (Object.keys(data.mcpServers).length === 0) {
      delete data.mcpServers;
    }
    return data;
  });

  return { deletedFiles: [], trashedTo: null, settingsModified: true };
}

// ── Main Delete Function ──────────────────────────────────────────────────────

// ── Session Deletion ─────────────────────────────────────────────────────────

async function deleteSession(item: DashboardItem): Promise<{ deletedFiles: string[]; trashedTo: string | null; settingsModified: boolean }> {
  const sessionId = item.metadata.sessionId ?? item.name;
  const deletedFiles: string[] = [];
  let trashedTo: string | null = null;

  // 1. Trash + delete the session JSON file
  try {
    trashedTo = await copyToTrash(item.filePath);
    await fs.unlink(item.filePath);
    deletedFiles.push(item.filePath);
  } catch { /* file may already be gone */ }

  // 2. Find and delete matching JSONL file(s) in projects directory
  const globalPath = path.dirname(path.dirname(item.filePath)); // sessions dir → .claude
  const projectsDir = path.join(globalPath, 'projects');
  try {
    const projDirs = await fs.readdir(projectsDir);
    await Promise.all(projDirs.map(async (dir) => {
      const jsonlPath = path.join(projectsDir, dir, `${sessionId}.jsonl`);
      try {
        await copyToTrash(jsonlPath);
        await fs.unlink(jsonlPath);
        deletedFiles.push(jsonlPath);
      } catch { /* JSONL not in this dir */ }
    }));
  } catch { /* projects dir may not exist */ }

  return { deletedFiles, trashedTo, settingsModified: false };
}

/**
 * Delete a dashboard item with soft-delete (trash) support.
 *
 * @param item             The item to delete.
 * @param allowedPrefixes  Directories the item's filePath must reside within.
 * @param scanAll          Callback to produce a fresh inventory after deletion.
 */
export async function deleteItem(
  item: DashboardItem,
  allowedPrefixes: string[],
  scanAll: () => Promise<InventorySummary>,
): Promise<DeleteResult> {
  // 1. Validate the item's path is within allowed directories.
  if (!validatePath(item.filePath, allowedPrefixes)) {
    throw new Error(
      `Path ${item.filePath} is not within any allowed directory.`,
    );
  }

  // 2. Validate mtime matches the cached value.
  // Skip for settings-backed items (hooks, MCP servers) — their filePath points to
  // settings.json which is frequently modified by other operations.
  if (item.category !== ItemCategory.HOOK && item.category !== ItemCategory.MCP_SERVER) {
    await validateMtime(item);
  }

  // 3. Category-specific deletion.
  let result: { deletedFiles: string[]; trashedTo: string | null; settingsModified: boolean };

  switch (item.category) {
    case ItemCategory.AGENT:
    case ItemCategory.COMMAND:
    case ItemCategory.RULE:
      result = await deleteAgentCommandRule(item);
      break;

    case ItemCategory.SKILL:
      result = await deleteSkill(item);
      break;

    case ItemCategory.HOOK:
      result = await deleteHook(item);
      break;

    case ItemCategory.PLUGIN:
      result = await deletePlugin(item);
      break;

    case ItemCategory.MCP_SERVER:
      result = await deleteMcpServer(item);
      break;

    case ItemCategory.SESSION:
      result = await deleteSession(item);
      break;

    case ItemCategory.CONFIG:
      throw new Error(
        `Items of category "${item.category}" are read-only and cannot be deleted.`,
      );

    default:
      throw new Error(`Unknown category: ${item.category}`);
  }

  // 4. Produce a fresh inventory.
  const inventory = await scanAll();

  // 5. Return the result.
  return {
    deletedId: item.id,
    deletedFiles: result.deletedFiles,
    trashedTo: result.trashedTo,
    settingsModified: result.settingsModified,
    inventory,
  };
}
