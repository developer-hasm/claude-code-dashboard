// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Health Checker
// ---------------------------------------------------------------------------

import fs from 'node:fs/promises';
import { platform } from 'node:os';

import { DashboardItem, ItemCategory, HealthStatus } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HealthResult {
  status: HealthStatus;
  details: string[];
}

// ── Per-category Checks ───────────────────────────────────────────────────────

async function checkHook(item: DashboardItem): Promise<HealthResult> {
  const details: string[] = [];
  let status: HealthStatus = HealthStatus.HEALTHY;

  const commandPath = item.metadata.commandPath ?? item.filePath;

  // Check that the command file exists.
  try {
    const stat = await fs.stat(commandPath);

    // On non-Windows platforms, check the executable bit.
    if (platform() !== 'win32') {
      // eslint-disable-next-line no-bitwise
      const isExecutable = (stat.mode & 0o111) !== 0;
      if (!isExecutable) {
        status = HealthStatus.WARNING;
        details.push(`Hook script is not executable: ${commandPath}`);
      }
    }
  } catch {
    status = HealthStatus.ERROR;
    details.push(`Hook command file not found: ${commandPath}`);
  }

  if (details.length === 0) {
    details.push('Hook script exists and is valid.');
  }

  return { status, details };
}

async function checkSkill(item: DashboardItem): Promise<HealthResult> {
  try {
    await fs.access(item.filePath);
    return { status: HealthStatus.HEALTHY, details: ['SKILL.md exists.'] };
  } catch {
    return {
      status: HealthStatus.ERROR,
      details: [`SKILL.md not found at ${item.filePath}`],
    };
  }
}

async function checkPlugin(item: DashboardItem): Promise<HealthResult> {
  const installPath = item.metadata.installPath;
  if (!installPath) {
    return {
      status: HealthStatus.WARNING,
      details: ['Plugin installPath is not set in metadata.'],
    };
  }

  try {
    const stat = await fs.stat(installPath);
    if (!stat.isDirectory()) {
      return {
        status: HealthStatus.ERROR,
        details: [`Plugin installPath is not a directory: ${installPath}`],
      };
    }
    return { status: HealthStatus.HEALTHY, details: ['Plugin install directory exists.'] };
  } catch {
    return {
      status: HealthStatus.ERROR,
      details: [`Plugin install directory not found: ${installPath}`],
    };
  }
}

async function checkAgent(item: DashboardItem): Promise<HealthResult> {
  try {
    const content = await fs.readFile(item.filePath, 'utf-8');
    // Attempt a basic frontmatter parse using gray-matter.
    // gray-matter is a devDependency; if unavailable we fall back to regex.
    try {
      const matter = await import('gray-matter');
      matter.default(content);
    } catch (importErr) {
      // gray-matter not available — try a simple regex check for valid YAML
      // frontmatter delimiters.
      if (content.startsWith('---')) {
        const endIdx = content.indexOf('---', 3);
        if (endIdx === -1) {
          return {
            status: HealthStatus.WARNING,
            details: ['Agent file has unclosed YAML frontmatter.'],
          };
        }
      }
    }
    return { status: HealthStatus.HEALTHY, details: ['Agent file parsed successfully.'] };
  } catch {
    return {
      status: HealthStatus.WARNING,
      details: [`Failed to read or parse agent file: ${item.filePath}`],
    };
  }
}

function checkMcpServer(item: DashboardItem): HealthResult {
  const authStatus = item.metadata.authStatus;
  if (authStatus === 'needs-auth') {
    return {
      status: HealthStatus.WARNING,
      details: ['MCP server requires authentication.'],
    };
  }
  return { status: HealthStatus.HEALTHY, details: ['MCP server configuration looks valid.'] };
}

// ── Main Health Check ─────────────────────────────────────────────────────────

/**
 * Run health validation rules against a single dashboard item.
 */
export async function checkHealth(item: DashboardItem): Promise<HealthResult> {
  switch (item.category) {
    case ItemCategory.HOOK:
      return checkHook(item);

    case ItemCategory.SKILL:
      return checkSkill(item);

    case ItemCategory.PLUGIN:
      return checkPlugin(item);

    case ItemCategory.AGENT:
      return checkAgent(item);

    case ItemCategory.MCP_SERVER:
      return checkMcpServer(item);

    default:
      return { status: HealthStatus.UNKNOWN, details: ['No health checks defined for this category.'] };
  }
}
