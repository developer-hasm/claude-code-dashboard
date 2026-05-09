// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Custom Server Entry Point (ES Module)
// ---------------------------------------------------------------------------
//
// Production entry point: `node server.mjs`
// Handles singleton enforcement, port allocation, PID file management,
// trash purging, and browser launch before delegating to the Next.js
// standalone server.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { execSync, fork } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_PORT = 19280;
const PORT_RANGE_END = 19289;
const TRASH_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── CLI flags ─────────────────────────────────────────────────────────────

const NO_OPEN = process.argv.includes('--no-open');

// ── Helpers ───────────────────────────────────────────────────────────────

function globalClaudePath() {
  return path.join(os.homedir(), '.claude');
}

/**
 * Walk up from cwd looking for a `.claude/` directory to detect project
 * context.  Returns the project root or null.
 */
function detectProjectPath() {
  let dir = path.resolve(process.cwd());
  while (true) {
    const claudeDir = path.join(dir, '.claude');
    if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Determine the PID file location based on context.
 */
function getPidFilePath(projectPath) {
  if (projectPath) {
    return path.join(projectPath, '.claude', 'dashboard.pid');
  }
  return path.join(globalClaudePath(), 'dashboard.pid');
}

/**
 * Attempt a GET to /api/health on the given port and resolve true if it
 * responds with HTTP 200 within 2 seconds.
 */
function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${port}/api/health`,
      { timeout: 2000 },
      (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Check if a port is available by trying to create a temporary server.
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => {
      srv.close(() => resolve(true));
    });
    srv.listen(port, '127.0.0.1');
  });
}

/**
 * Find the first available port in the range [BASE_PORT .. PORT_RANGE_END].
 */
async function findAvailablePort() {
  for (let p = BASE_PORT; p <= PORT_RANGE_END; p++) {
    if (await isPortAvailable(p)) return p;
  }
  throw new Error(
    `No available port in range ${BASE_PORT}-${PORT_RANGE_END}`,
  );
}

/**
 * Open a URL in the default browser using platform-appropriate command.
 */
function openBrowser(url) {
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore' });
    } else if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    }
  } catch {
    // Silently ignore — headless environments may not have a browser.
    console.warn('[dashboard] Could not open browser automatically.');
  }
}

/**
 * Purge stale entries in the dashboard-trash directory (older than 24h).
 */
function purgeStaleTrash(trashDir) {
  if (!fs.existsSync(trashDir)) return;

  const now = Date.now();
  let entries;
  try {
    entries = fs.readdirSync(trashDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(trashDir, entry.name);
    try {
      const stat = fs.statSync(entryPath);
      if (now - stat.mtimeMs > TRASH_MAX_AGE_MS) {
        fs.rmSync(entryPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore individual failures
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  // 1. Detect context
  const projectPath = detectProjectPath();
  const globalPath = globalClaudePath();

  // 2. Determine PID file path
  const pidFilePath = getPidFilePath(projectPath);

  // 3. Check existing PID file
  if (fs.existsSync(pidFilePath)) {
    try {
      const pidData = JSON.parse(fs.readFileSync(pidFilePath, 'utf-8'));
      const existingPort = pidData.port;

      const healthy = await checkHealth(existingPort);
      if (healthy) {
        const url = `http://127.0.0.1:${existingPort}`;
        console.log(`[dashboard] Already running at ${url}`);
        if (!NO_OPEN) openBrowser(url);
        process.exit(0);
      }

      // Stale PID — remove
      fs.unlinkSync(pidFilePath);
    } catch {
      // Corrupt PID file — remove and continue
      try { fs.unlinkSync(pidFilePath); } catch { /* ignore */ }
    }
  }

  // 4. Find available port
  const port = await findAvailablePort();

  // 5. Write PID file with exclusive flag
  const pidDir = path.dirname(pidFilePath);
  if (!fs.existsSync(pidDir)) {
    fs.mkdirSync(pidDir, { recursive: true });
  }

  const pidContent = JSON.stringify(
    {
      pid: process.pid,
      port,
      startedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  try {
    fs.writeFileSync(pidFilePath, pidContent, { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') {
      console.error(
        '[dashboard] PID file appeared while starting — another instance may have launched.',
      );
      process.exit(1);
    }
    throw err;
  }

  // 6. Ensure trash directory and purge stale entries
  const trashDir = path.join(globalPath, 'dashboard-trash');
  if (!fs.existsSync(trashDir)) {
    fs.mkdirSync(trashDir, { recursive: true });
  }
  purgeStaleTrash(trashDir);

  // 7. Generate auth token
  const token = randomBytes(32).toString('hex');

  // 8. Start Next.js standalone server
  const standaloneServer = path.join(__dirname, '.next', 'standalone', 'server.js');
  if (!fs.existsSync(standaloneServer)) {
    console.error(
      '[dashboard] Standalone server not found. Run `npm run build` first.',
    );
    cleanup(pidFilePath);
    process.exit(1);
  }

  const child = fork(standaloneServer, [], {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      DASHBOARD_TOKEN: token,
      DASHBOARD_PORT: String(port),
      DASHBOARD_PROJECT_PATH: projectPath || '',
      DASHBOARD_GLOBAL_PATH: globalPath,
    },
    stdio: 'inherit',
  });

  child.on('error', (err) => {
    console.error('[dashboard] Failed to start server:', err.message);
    cleanup(pidFilePath);
    process.exit(1);
  });

  child.on('exit', (code) => {
    cleanup(pidFilePath);
    process.exit(code ?? 0);
  });

  // 9. Open browser (with a small delay to let the server start)
  if (!NO_OPEN) {
    setTimeout(() => {
      openBrowser(`http://127.0.0.1:${port}`);
    }, 1500);
  }

  // 10. Log
  console.log(`[dashboard] Dashboard running at http://127.0.0.1:${port}`);

  // ── Shutdown handlers ─────────────────────────────────────────────────

  function shutdown() {
    cleanup(pidFilePath);
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
    process.exit(0);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

function cleanup(pidFilePath) {
  try {
    fs.unlinkSync(pidFilePath);
  } catch {
    // Already removed or never created
  }
}

main().catch((err) => {
  console.error('[dashboard] Fatal error:', err);
  process.exit(1);
});
