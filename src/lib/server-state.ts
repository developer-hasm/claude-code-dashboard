// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Server Runtime State (Singleton)
// ---------------------------------------------------------------------------

import { generateToken } from './security';
import { detectContext } from './context';

// ── Internal state ────────────────────────────────────────────────────────

let _token: string = '';
let _port: number = 0;
let _projectPath: string | null = null;
let _globalPath: string = '';
let _initialized = false;

// ── Initialization (called by server.ts) ──────────────────────────────────

export function initServerState(
  token: string,
  port: number,
  projectPath: string | null,
  globalPath: string,
): void {
  _token = token;
  _port = port;
  _projectPath = projectPath;
  _globalPath = globalPath;
  _initialized = true;
}

// ── Lazy init for dev mode ────────────────────────────────────────────────

function ensureInitialized(): void {
  if (_initialized) return;
  _initialized = true;

  // Environment variables (set by server.mjs in production)
  if (process.env.DASHBOARD_TOKEN) _token = process.env.DASHBOARD_TOKEN;
  if (process.env.DASHBOARD_PORT) _port = parseInt(process.env.DASHBOARD_PORT, 10);
  if (process.env.DASHBOARD_PROJECT_PATH) _projectPath = process.env.DASHBOARD_PROJECT_PATH;
  if (process.env.DASHBOARD_GLOBAL_PATH) _globalPath = process.env.DASHBOARD_GLOBAL_PATH;

  // Auto-detect what's still missing
  if (!_token) {
    _token = generateToken();
  }
  if (!_port) {
    _port = 19280;
  }
  if (!_globalPath) {
    const ctx = detectContext();
    _projectPath = ctx.projectPath;
    _globalPath = ctx.globalPath;
  }
}

// ── Accessors ─────────────────────────────────────────────────────────────

export function getToken(): string {
  ensureInitialized();
  return _token;
}

export function getPort(): number {
  ensureInitialized();
  return _port;
}

export function getProjectPath(): string | null {
  ensureInitialized();
  return _projectPath;
}

export function getGlobalPath(): string {
  ensureInitialized();
  return _globalPath;
}
