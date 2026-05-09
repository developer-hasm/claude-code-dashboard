---
description: Build (if needed) and start the Claude Code Dashboard server
---

Start the Claude Code Dashboard. The server auto-opens the user's default browser.

The plugin's install path is available as `${CLAUDE_PLUGIN_ROOT}`.

Steps:

1. **Check if already running**:
   - Look for PID files at `~/.claude/dashboard.pid` (global) and `<cwd>/.claude/dashboard.pid` (project).
   - If found, hit `http://127.0.0.1:<port>/api/health`. If healthy, open that URL in the browser and stop.

2. **Build if needed**:
   - If `${CLAUDE_PLUGIN_ROOT}/.next/standalone/server.js` does NOT exist:
     - Run: `cd "${CLAUDE_PLUGIN_ROOT}" && npm install --no-audit --no-fund` (one-time, ~30s)
     - Run: `cd "${CLAUDE_PLUGIN_ROOT}" && npm run build` (one-time, ~30s)
   - Note: `npm run build` already copies `.next/static` into the standalone dir.

3. **Start the server** (do NOT pass `--no-open` — the server should open the browser automatically):
   - Run from the user's current working directory (so the dashboard auto-detects the right `.claude/` folder).
   - On Windows: `powershell -Command "Start-Process -FilePath 'node' -ArgumentList '${CLAUDE_PLUGIN_ROOT}/server.mjs' -WindowStyle Hidden -RedirectStandardOutput '${CLAUDE_PLUGIN_ROOT}/dashboard.log' -RedirectStandardError '${CLAUDE_PLUGIN_ROOT}/dashboard.err'"`
   - On macOS/Linux: `nohup node "${CLAUDE_PLUGIN_ROOT}/server.mjs" > "${CLAUDE_PLUGIN_ROOT}/dashboard.log" 2>&1 &`
   - Wait 3-5 seconds, then poll `http://127.0.0.1:19280/api/health` (try ports 19280-19289 in order).

4. **Report**: Print the dashboard URL (e.g. `http://127.0.0.1:19280`). The browser should already be open — tell the user the dashboard is ready.

If anything fails, print the error and the log file path: `${CLAUDE_PLUGIN_ROOT}/dashboard.log`.
