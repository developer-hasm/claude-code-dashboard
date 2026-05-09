// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — SQLite Usage Database (v1.1)
// ---------------------------------------------------------------------------

import Database from 'better-sqlite3';
import path from 'node:path';
import { homedir } from 'node:os';
import fs from 'node:fs';

// ── Singleton ─────────────────────────────────────────────────────────────

let dbInstance: Database.Database | null = null;

const DB_DIR = path.join(homedir(), '.claude', 'dashboard-data');
const DB_PATH = path.join(DB_DIR, 'usage.db');

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(DB_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  dbInstance = db;
  return db;
}

// ── Migrations ────────────────────────────────────────────────────────────

interface Migration {
  version: number;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS processed_files (
        path TEXT PRIMARY KEY,
        mtime_ms REAL NOT NULL,
        file_size INTEGER NOT NULL,
        lines_processed INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        message_id TEXT UNIQUE,
        timestamp TEXT NOT NULL,
        model TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cache_creation_tokens INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0,
        tool_names TEXT,
        agent_name TEXT,
        skill_name TEXT,
        cwd TEXT,
        synthetic_key TEXT,
        source_file TEXT
      );

      CREATE TABLE IF NOT EXISTS user_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        content_preview TEXT,
        source_file TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        first_timestamp TEXT,
        last_timestamp TEXT,
        total_cost_usd REAL DEFAULT 0,
        turn_count INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        first_prompt TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_turns_timestamp ON turns(timestamp);
      CREATE INDEX IF NOT EXISTS idx_turns_session_id ON turns(session_id);
      CREATE INDEX IF NOT EXISTS idx_turns_agent_name
        ON turns(agent_name) WHERE agent_name IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_turns_skill_name
        ON turns(skill_name) WHERE skill_name IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_turns_synthetic_key
        ON turns(synthetic_key) WHERE synthetic_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_user_messages_session ON user_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_user_messages_timestamp ON user_messages(timestamp);
    `,
  },
  // Future migrations go here: { version: 2, sql: 'ALTER TABLE ...' },
];

function runMigrations(db: Database.Database): void {
  // Ensure schema_version table exists for bootstrapping
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`);

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as
    | { v: number | null }
    | undefined;
  const currentVersion = row?.v ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      db.exec(migration.sql);
      db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(
        migration.version,
      );
    }
  }
}

// ── Processed Files ───────────────────────────────────────────────────────

export interface ProcessedFileRecord {
  path: string;
  mtime_ms: number;
  file_size: number;
  lines_processed: number;
}

export function getProcessedFile(filePath: string): ProcessedFileRecord | undefined {
  const db = getDb();
  return db
    .prepare('SELECT path, mtime_ms, file_size, lines_processed FROM processed_files WHERE path = ?')
    .get(filePath) as ProcessedFileRecord | undefined;
}

export function upsertProcessedFile(
  filePath: string,
  mtimeMs: number,
  fileSize: number,
  linesProcessed: number,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO processed_files (path, mtime_ms, file_size, lines_processed)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       mtime_ms = excluded.mtime_ms,
       file_size = excluded.file_size,
       lines_processed = excluded.lines_processed`,
  ).run(filePath, mtimeMs, fileSize, linesProcessed);
}

// ── Turns ─────────────────────────────────────────────────────────────────

export interface TurnRecord {
  messageId: string | null;
  syntheticKey: string | null;
  sessionId: string;
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  toolNames: string[];
  agentName: string | null;
  skillName: string | null;
  cwd: string | null;
  sourceFile: string | null;
}

export function upsertTurn(turn: TurnRecord): void {
  if (!turn.messageId) {
    throw new Error('upsertTurn requires a non-null messageId. Use insertTurnWithSyntheticKey for messages without ID.');
  }
  const db = getDb();
  const toolNamesJson = turn.toolNames.length > 0 ? JSON.stringify(turn.toolNames) : null;
  db.prepare(
    `INSERT INTO turns (message_id, session_id, timestamp, model,
       input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
       cost_usd, tool_names, agent_name, skill_name, cwd, source_file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(message_id) DO UPDATE SET
       input_tokens = excluded.input_tokens,
       output_tokens = excluded.output_tokens,
       cache_read_tokens = excluded.cache_read_tokens,
       cache_creation_tokens = excluded.cache_creation_tokens,
       cost_usd = excluded.cost_usd,
       tool_names = excluded.tool_names,
       model = excluded.model,
       agent_name = excluded.agent_name,
       skill_name = excluded.skill_name,
       timestamp = excluded.timestamp`,
  ).run(
    turn.messageId,
    turn.sessionId,
    turn.timestamp,
    turn.model,
    turn.inputTokens,
    turn.outputTokens,
    turn.cacheReadTokens,
    turn.cacheCreationTokens,
    turn.costUsd,
    toolNamesJson,
    turn.agentName,
    turn.skillName,
    turn.cwd,
    turn.sourceFile,
  );
}

export function insertTurnWithSyntheticKey(turn: TurnRecord): void {
  const db = getDb();
  const toolNamesJson = turn.toolNames.length > 0 ? JSON.stringify(turn.toolNames) : null;
  db.prepare(
    `INSERT OR IGNORE INTO turns (synthetic_key, session_id, timestamp, model,
       input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
       cost_usd, tool_names, agent_name, skill_name, cwd, source_file)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    turn.syntheticKey,
    turn.sessionId,
    turn.timestamp,
    turn.model,
    turn.inputTokens,
    turn.outputTokens,
    turn.cacheReadTokens,
    turn.cacheCreationTokens,
    turn.costUsd,
    toolNamesJson,
    turn.agentName,
    turn.skillName,
    turn.cwd,
    turn.sourceFile,
  );
}

// ── User Messages ─────────────────────────────────────────────────────────

export function insertUserMessage(
  sessionId: string,
  timestamp: string,
  contentPreview: string | null,
  sourceFile: string | null,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO user_messages (session_id, timestamp, content_preview, source_file)
     VALUES (?, ?, ?, ?)`,
  ).run(sessionId, timestamp, contentPreview, sourceFile);
}

// ── Session Refresh ───────────────────────────────────────────────────────

export function refreshSession(sessionId: string): void {
  const db = getDb();

  // Check if any turns exist for this session
  const turnExists = db.prepare('SELECT 1 FROM turns WHERE session_id = ? LIMIT 1').get(sessionId);
  if (!turnExists) {
    // No turns — remove orphaned session row
    db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
    return;
  }

  db.prepare(
    `INSERT INTO sessions (session_id, first_timestamp, last_timestamp,
       total_cost_usd, turn_count, message_count, first_prompt)
     SELECT
       t.session_id,
       MIN(t.timestamp),
       MAX(t.timestamp),
       SUM(t.cost_usd),
       COUNT(*),
       (SELECT COUNT(*) FROM user_messages u WHERE u.session_id = t.session_id),
       (SELECT content_preview FROM user_messages u
        WHERE u.session_id = t.session_id ORDER BY timestamp LIMIT 1)
     FROM turns t
     WHERE t.session_id = ?
     GROUP BY t.session_id
     ON CONFLICT(session_id) DO UPDATE SET
       first_timestamp = excluded.first_timestamp,
       last_timestamp = excluded.last_timestamp,
       total_cost_usd = excluded.total_cost_usd,
       turn_count = excluded.turn_count,
       message_count = excluded.message_count,
       first_prompt = excluded.first_prompt`,
  ).run(sessionId);
}

// ── Query Helpers ─────────────────────────────────────────────────────────

export interface DailyStatRow {
  date: string;
  sessionCount: number;
  turnCount: number;
  messageCount: number;
}

export function getDailyStats(days: number): DailyStatRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT date(t.timestamp) as date,
              COUNT(DISTINCT t.session_id) as sessionCount,
              COUNT(*) as turnCount,
              COALESCE(um.msgCount, 0) as messageCount
       FROM turns t
       LEFT JOIN (
         SELECT date(timestamp) as date, COUNT(*) as msgCount
         FROM user_messages
         GROUP BY date(timestamp)
       ) um ON um.date = date(t.timestamp)
       WHERE t.timestamp >= datetime('now', '-' || ? || ' days')
       GROUP BY date(t.timestamp)
       ORDER BY date ASC`,
    )
    .all(days) as DailyStatRow[];
}

export interface WeeklyTopRow {
  name: string;
  usageCount: number;
}

export function getWeeklyTop5(): { agents: WeeklyTopRow[]; skills: WeeklyTopRow[] } {
  const db = getDb();

  const agents = db
    .prepare(
      `SELECT agent_name as name, COUNT(*) as usageCount
       FROM turns
       WHERE agent_name IS NOT NULL
         AND timestamp >= datetime('now', '-7 days')
       GROUP BY agent_name
       ORDER BY usageCount DESC
       LIMIT 5`,
    )
    .all() as WeeklyTopRow[];

  const skills = db
    .prepare(
      `SELECT skill_name as name, COUNT(*) as usageCount
       FROM turns
       WHERE skill_name IS NOT NULL
         AND timestamp >= datetime('now', '-7 days')
       GROUP BY skill_name
       ORDER BY usageCount DESC
       LIMIT 5`,
    )
    .all() as WeeklyTopRow[];

  return { agents, skills };
}

export interface ToolTopRow {
  toolName: string;
  usageCount: number;
}

export function getToolTop5(): ToolTopRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT j.value as toolName, COUNT(*) as usageCount
       FROM turns, json_each(turns.tool_names) j
       WHERE turns.timestamp >= datetime('now', '-30 days')
         AND turns.tool_names IS NOT NULL
       GROUP BY j.value
       ORDER BY usageCount DESC
       LIMIT 5`,
    )
    .all() as ToolTopRow[];
}

export function getLastUsed(): Map<string, string> {
  const db = getDb();
  const result = new Map<string, string>();

  const agentRows = db
    .prepare(
      `SELECT agent_name as name, MAX(timestamp) as lastUsed
       FROM turns WHERE agent_name IS NOT NULL GROUP BY agent_name`,
    )
    .all() as { name: string; lastUsed: string }[];
  for (const row of agentRows) {
    result.set(row.name, row.lastUsed);
  }

  const skillRows = db
    .prepare(
      `SELECT skill_name as name, MAX(timestamp) as lastUsed
       FROM turns WHERE skill_name IS NOT NULL GROUP BY skill_name`,
    )
    .all() as { name: string; lastUsed: string }[];
  for (const row of skillRows) {
    result.set(row.name, row.lastUsed);
  }

  return result;
}

export interface DailyCostRow {
  date: string;
  estimatedCost: number;
}

export function getDailyCosts(days: number): DailyCostRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT date(timestamp) as date, SUM(cost_usd) as estimatedCost
       FROM turns
       WHERE timestamp >= datetime('now', '-' || ? || ' days')
       GROUP BY date(timestamp)
       ORDER BY date ASC`,
    )
    .all(days) as DailyCostRow[];
}

// ── Types ────────────────────────────────────────────────────────────────

export interface MigrationStatus {
  isComplete: boolean;
  processed: number;
  total: number;
}

// ── Cleanup ───────────────────────────────────────────────────────────────

export function deleteFileData(filePath: string): void {
  const db = getDb();
  db.prepare('DELETE FROM turns WHERE source_file = ?').run(filePath);
  db.prepare('DELETE FROM user_messages WHERE source_file = ?').run(filePath);
  db.prepare('DELETE FROM processed_files WHERE path = ?').run(filePath);
}

export function cleanOrphanedFiles(): void {
  const db = getDb();
  const rows = db.prepare('SELECT path FROM processed_files').all() as { path: string }[];
  for (const row of rows) {
    if (!fs.existsSync(row.path)) {
      // Remove processed_files entry but preserve turns data
      db.prepare('DELETE FROM processed_files WHERE path = ?').run(row.path);
    }
  }
}
