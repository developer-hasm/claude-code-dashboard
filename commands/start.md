---
description: Build (if needed) and start the Claude Code Dashboard server
---

Start the Claude Code Dashboard.

The plugin's install path is available as `${CLAUDE_PLUGIN_ROOT}`.

Steps:

1. **Check if already running**:
   - Look for PID files at `${CLAUDE_PLUGIN_ROOT}/../../../../dashboard.pid` (user `~/.claude/dashboard.pid`) and `<cwd>/.claude/dashboard.pid`.
   - If found, hit `http://127.0.0.1:<port>/api/health`. If healthy, just print the URL and stop.

2. **Build if needed**:
   - If `${CLAUDE_PLUGIN_ROOT}/.next/standalone/server.js` does NOT exist:
     - Run: `cd "${CLAUDE_PLUGIN_ROOT}" && npm install --no-audit --no-fund`
     - Run: `cd "${CLAUDE_PLUGIN_ROOT}" && npm run build`
   - Note: `npm run build` already copies `.next/static` into the standalone dir.

3. **Start the server**:
   - Run from the user's current working directory (so the dashboard auto-detects the right `.claude/` folder):
     - On Windows (PowerShell): `Start-Process -FilePath 'node' -ArgumentList '${CLAUDE_PLUGIN_ROOT}/server.mjs','--no-open' -WindowStyle Hidden`
     - On macOS/Linux: `node "${CLAUDE_PLUGIN_ROOT}/server.mjs" --no-open &`
   - Wait 3-5 seconds, then poll `http://127.0.0.1:19280/api/health` (try ports 19280-19289).

4. **Report**: Print the dashboard URL (e.g. `http://127.0.0.1:19280`) and tell the user to open it in their browser.

If anything fails, print the error and the log file path: `${CLAUDE_PLUGIN_ROOT}/dashboard.log`.
