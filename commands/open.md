---
description: Open the Claude Code Dashboard in the browser (start the server if it isn't running)
---

Open the Claude Code Dashboard. This command is idempotent — running it again just brings the browser to the existing dashboard.

The plugin's install path is available as `${CLAUDE_PLUGIN_ROOT}`. The server itself handles the "already running" case (PID detection, health check, browser-open-and-exit), so all you need to do is build (one-time) and run `node server.mjs`.

Steps:

1. **Build if missing** (one-time, ~1 minute total):
   - If `${CLAUDE_PLUGIN_ROOT}/.next/standalone/server.js` does NOT exist:
     - `cd "${CLAUDE_PLUGIN_ROOT}" && npm install --no-audit --no-fund`
     - `cd "${CLAUDE_PLUGIN_ROOT}" && npm run build`

2. **Run the server** (do NOT pass `--no-open` — `server.mjs` opens the browser automatically, including when an existing instance is detected):
   - On Windows: `powershell -Command "Start-Process -FilePath 'node' -ArgumentList '${CLAUDE_PLUGIN_ROOT}/server.mjs' -WindowStyle Hidden -RedirectStandardOutput '${CLAUDE_PLUGIN_ROOT}/dashboard.log' -RedirectStandardError '${CLAUDE_PLUGIN_ROOT}/dashboard.err'"`
   - On macOS/Linux: `nohup node "${CLAUDE_PLUGIN_ROOT}/server.mjs" > "${CLAUDE_PLUGIN_ROOT}/dashboard.log" 2>&1 &`

   `server.mjs` behavior (already implemented, no need to replicate):
   - If a healthy dashboard is already running → opens the browser to that URL → exits 0
   - If no instance is running → finds a free port (19280-19289) → starts → opens the browser

3. **Confirm**: Wait 2-3 seconds, then poll `http://127.0.0.1:19280/api/health` (try 19280-19289). Once it responds with `{ ok: true }`, print the URL and tell the user the dashboard is open in their browser.

If anything fails, print the error and the log file path: `${CLAUDE_PLUGIN_ROOT}/dashboard.log`.
