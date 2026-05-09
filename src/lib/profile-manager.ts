// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Settings Profile Manager
// ---------------------------------------------------------------------------

import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

import {
  DashboardItem,
  ExportProfile,
  ProfileInfo,
  ItemScope,
} from './types';
import { ExecutionContext } from './context';
import { exportAll, applyImport, validateProfile } from './exporter';
import { atomicWriteJson } from './settings-mutex';

// ── Constants ─────────────────────────────────────────────────────────────

const PROFILES_DIR = path.join(homedir(), '.claude', 'dashboard-profiles');
const ACTIVE_FILE = path.join(PROFILES_DIR, '.active');
const NAME_REGEX = /^[a-zA-Z0-9-]{1,50}$/;
const RESERVED_NAMES = new Set(['default', 'backup']);

// ── Helpers ───────────────────────────────────────────────────────────────

async function ensureProfilesDir(): Promise<void> {
  await fs.mkdir(PROFILES_DIR, { recursive: true });
}

function validateName(name: string): void {
  if (!NAME_REGEX.test(name)) {
    throw new Error(
      `Invalid profile name "${name}". Must match [a-zA-Z0-9-]{1,50}.`,
    );
  }
  if (RESERVED_NAMES.has(name.toLowerCase())) {
    throw new Error(`Profile name "${name}" is reserved.`);
  }
}

function profilePath(name: string): string {
  return path.join(PROFILES_DIR, `${name}.claude-profile.json`);
}

// ── Public API ────────────────────────────────────────────────────────────

export async function listProfiles(): Promise<ProfileInfo[]> {
  await ensureProfilesDir();

  let entries: string[];
  try {
    entries = await fs.readdir(PROFILES_DIR);
  } catch {
    return [];
  }

  const profileFiles = entries.filter((e) => e.endsWith('.claude-profile.json'));

  const results = await Promise.all(
    profileFiles.map(async (entry): Promise<ProfileInfo | null> => {
      const filePath = path.join(PROFILES_DIR, entry);
      try {
        const [raw, stat] = await Promise.all([
          fs.readFile(filePath, 'utf-8'),
          fs.stat(filePath),
        ]);
        const data = JSON.parse(raw) as ExportProfile;

        const itemCount =
          (data.agents?.length ?? 0) +
          (data.skills?.length ?? 0) +
          (data.hooks?.length ?? 0) +
          (data.commands?.length ?? 0) +
          (data.rules?.length ?? 0) +
          (data.mcpServers?.length ?? 0) +
          (data.plugins?.length ?? 0);

        return {
          name: data.name || entry.replace('.claude-profile.json', ''),
          description: data.description || '',
          scope: data.scope || ItemScope.GLOBAL,
          itemCount,
          createdAt: data.exportedAt || stat.birthtime.toISOString(),
          filePath,
        };
      } catch {
        return null;
      }
    }),
  );

  return results.filter((r): r is ProfileInfo => r !== null);
}

export async function saveProfile(
  name: string,
  items: DashboardItem[],
): Promise<void> {
  validateName(name);
  await ensureProfilesDir();

  const profile = await exportAll(items, { includeLocalSettings: false });
  profile.name = name;
  profile.description = `Profile: ${name}`;

  await atomicWriteJson(profilePath(name), profile);
}

export async function switchProfile(
  name: string,
  context: ExecutionContext,
): Promise<void> {
  validateName(name);

  const filePath = profilePath(name);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`Profile "${name}" not found at ${filePath}`);
  }

  const profile = JSON.parse(raw) as ExportProfile;
  const validation = validateProfile(profile);
  if (!validation.valid) {
    throw new Error(`Invalid profile: ${validation.errors.join(', ')}`);
  }

  // Apply with overwrite mode (applyImport handles auto-backup internally)
  await applyImport(profile, 'overwrite', {}, {
    projectPath: context.projectPath,
    globalPath: context.globalPath,
  });

  // Track active profile
  await ensureProfilesDir();
  await fs.writeFile(ACTIVE_FILE, name, 'utf-8');
}

export async function deleteProfile(name: string): Promise<void> {
  validateName(name);

  const filePath = profilePath(name);
  try {
    await fs.unlink(filePath);
  } catch {
    throw new Error(`Profile "${name}" not found.`);
  }

  // Clear active marker if this was the active profile
  try {
    const active = await fs.readFile(ACTIVE_FILE, 'utf-8');
    if (active.trim() === name) {
      await fs.unlink(ACTIVE_FILE);
    }
  } catch {
    // No active file — nothing to clear
  }
}
