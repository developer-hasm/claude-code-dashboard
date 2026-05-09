// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Incremental JSONL Scanner (v1.1)
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  upsertProcessedFile,
  getProcessedFile,
  upsertTurn,
  insertTurnWithSyntheticKey,
  insertUserMessage,
  refreshSession,
  deleteFileData,
  cleanOrphanedFiles,
  type TurnRecord,
  type MigrationStatus,
} from './usage-db';
import { estimateCost } from './cost-estimator';

// ── Migration State ───────────────────────────────────────────────────────

let isMigrationComplete = false;
let migrationProcessed = 0;
let migrationTotal = 0;
let fullScanRunning = false;

export function getMigrationProgress(): MigrationStatus {
  return {
    isComplete: isMigrationComplete,
    processed: migrationProcessed,
    total: migrationTotal,
  };
}

// ── Main Entry Points ─────────────────────────────────────────────────────

/**
 * Incremental scan: only process new/changed lines since last scan.
 */
export async function runIncrementalScan(globalPath: string): Promise<void> {
  const projectsDir = path.join(globalPath, 'projects');
  if (!fs.existsSync(projectsDir)) return;

  const jsonlFiles = await listJsonlFiles(projectsDir);
  const affectedSessions = new Set<string>();

  for (const filePath of jsonlFiles) {
    const sessionId = parseSessionId(filePath);
    const stat = await fsp.stat(filePath);
    const existing = getProcessedFile(filePath);

    if (existing) {
      // Unchanged — skip
      if (existing.mtime_ms === stat.mtimeMs && existing.file_size === stat.size) {
        continue;
      }

      // Truncated/rotated — full rescan of this file
      if (stat.size < existing.file_size) {
        deleteFileData(filePath);
        await parseFile(filePath, sessionId, 0);
        affectedSessions.add(sessionId);
        continue;
      }

      // Appended — parse only new lines
      await parseFile(filePath, sessionId, existing.lines_processed);
      affectedSessions.add(sessionId);
    } else {
      // New file — full parse
      await parseFile(filePath, sessionId, 0);
      affectedSessions.add(sessionId);
    }
  }

  // Refresh sessions
  for (const sessionId of affectedSessions) {
    refreshSession(sessionId);
  }
}

/**
 * Full scan: process ALL lines in all JSONL files. Used on first run.
 */
export async function runFullScan(globalPath: string): Promise<void> {
  if (fullScanRunning) return;
  fullScanRunning = true;
  try {
    const projectsDir = path.join(globalPath, 'projects');
    if (!fs.existsSync(projectsDir)) {
      isMigrationComplete = true;
      return;
    }

    const jsonlFiles = await listJsonlFiles(projectsDir);
    migrationTotal = jsonlFiles.length;
    migrationProcessed = 0;
    const affectedSessions = new Set<string>();

    for (const filePath of jsonlFiles) {
      const sessionId = parseSessionId(filePath);

      // Delete existing data to ensure clean state
      deleteFileData(filePath);
      await parseFile(filePath, sessionId, 0);
      affectedSessions.add(sessionId);

      migrationProcessed++;
    }

    // Refresh all affected sessions
    for (const sessionId of affectedSessions) {
      refreshSession(sessionId);
    }

    cleanOrphanedFiles();
    isMigrationComplete = true;
  } finally {
    fullScanRunning = false;
  }
}

// ── File Discovery ────────────────────────────────────────────────────────

async function listJsonlFiles(projectsDir: string): Promise<string[]> {
  const result: string[] = [];
  let subdirs: string[];
  try {
    subdirs = await fsp.readdir(projectsDir);
  } catch {
    return result;
  }

  for (const sub of subdirs) {
    const subPath = path.join(projectsDir, sub);
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(subPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    let files: string[];
    try {
      files = await fsp.readdir(subPath);
    } catch {
      continue;
    }
    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        result.push(path.join(subPath, file));
      }
    }
  }
  return result;
}

// ── JSONL Parsing ─────────────────────────────────────────────────────────

async function parseFile(
  filePath: string,
  sessionId: string,
  skipLines: number,
): Promise<void> {
  let content: string;
  try {
    content = await fsp.readFile(filePath, 'utf8');
  } catch {
    return;
  }

  const lines = content.split('\n');
  const pendingByMessageId = new Map<string, TurnRecord>();

  for (let i = 0; i < lines.length; i++) {
    if (i < skipLines) continue; // skip already-processed lines by raw index
    const line = lines[i].trim();
    if (!line) continue; // skip blank lines for parsing

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }

    const type = msg.type as string | undefined;
    const timestamp = normalizeTimestamp(msg.timestamp);
    const cwd = (msg.cwd as string) ?? null;
    const message = msg.message as Record<string, unknown> | undefined;

    // Path 1: User message
    if (type === 'user' && message?.role === 'user') {
      const contentPreview = extractContentPreview(message.content);
      insertUserMessage(sessionId, timestamp, contentPreview, filePath);
      continue;
    }

    // Path 2 & 3: Assistant message
    if (type === 'assistant' && message) {
      const messageId = (message.id as string) ?? null;
      const model = (message.model as string) ?? '';
      const usage = message.usage as Record<string, unknown> | undefined;
      const content = message.content;

      const inputTokens = (usage?.input_tokens as number) ?? 0;
      const outputTokens = (usage?.output_tokens as number) ?? 0;
      const cacheReadTokens = (usage?.cache_read_input_tokens as number) ?? 0;
      const cacheCreationTokens = (usage?.cache_creation_input_tokens as number) ?? 0;

      const toolNames = extractToolNames(content);
      const agentName = extractAgentName(content);
      const skillName = extractSkillName(content);

      const costUsd = estimateCost({
        model,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
      });

      const turn: TurnRecord = {
        messageId,
        syntheticKey: messageId ? null : `${sessionId}:${timestamp}:${i}`,
        sessionId,
        timestamp,
        model,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        costUsd,
        toolNames,
        agentName,
        skillName,
        cwd,
        sourceFile: filePath,
      };

      if (messageId) {
        // Path 2: Dedup — last wins
        pendingByMessageId.set(messageId, turn);
      } else {
        // Path 3: No message ID — insert with synthetic key
        insertTurnWithSyntheticKey(turn);
      }
    }
  }

  // Flush deduplicated turns
  for (const turn of pendingByMessageId.values()) {
    upsertTurn(turn);
  }

  // Update processed_files tracking — store raw line count
  try {
    const stat = await fsp.stat(filePath);
    upsertProcessedFile(filePath, stat.mtimeMs, stat.size, lines.length);
  } catch {
    // File may have been deleted between read and stat
  }
}

// ── Content Extraction Helpers ────────────────────────────────────────────

/**
 * Extract tool_use block names from assistant message content.
 */
export function extractToolNames(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  const names: string[] = [];
  for (const block of content) {
    if (
      block &&
      typeof block === 'object' &&
      (block as Record<string, unknown>).type === 'tool_use' &&
      typeof (block as Record<string, unknown>).name === 'string'
    ) {
      names.push((block as Record<string, string>).name);
    }
  }
  return names;
}

/**
 * Extract agent name from Agent tool_use's subagent_type input.
 */
export function extractAgentName(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (
      block &&
      typeof block === 'object' &&
      (block as Record<string, unknown>).type === 'tool_use' &&
      (block as Record<string, unknown>).name === 'Agent'
    ) {
      const input = (block as Record<string, unknown>).input as Record<string, unknown> | undefined;
      if (input && typeof input.subagent_type === 'string') {
        return input.subagent_type;
      }
    }
  }
  return null;
}

/**
 * Extract skill name from Skill tool_use's skill input.
 */
export function extractSkillName(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (
      block &&
      typeof block === 'object' &&
      (block as Record<string, unknown>).type === 'tool_use' &&
      (block as Record<string, unknown>).name === 'Skill'
    ) {
      const input = (block as Record<string, unknown>).input as Record<string, unknown> | undefined;
      if (input && typeof input.skill === 'string') {
        return input.skill;
      }
    }
  }
  return null;
}

/**
 * Extract a content preview (first 200 chars) from a user message.
 */
function extractContentPreview(content: unknown): string | null {
  if (typeof content === 'string') {
    return content.slice(0, 200) || null;
  }
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === 'object' && (block as Record<string, unknown>).type === 'text') {
        const text = (block as Record<string, string>).text;
        if (typeof text === 'string') {
          return text.slice(0, 200) || null;
        }
      }
    }
  }
  return null;
}

/**
 * Parse session ID from JSONL filename (basename without .jsonl extension).
 */
function parseSessionId(filePath: string): string {
  return path.basename(filePath, '.jsonl');
}

/**
 * Normalize a timestamp to UTC ISO 8601.
 * Handles both ISO strings and epoch millisecond numbers.
 */
function normalizeTimestamp(raw: unknown): string {
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  if (typeof raw === 'number') {
    return new Date(raw).toISOString();
  }
  return new Date().toISOString();
}
