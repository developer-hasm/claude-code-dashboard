---
description: Stop the running Claude Code Dashboard server
---

Stop the Claude Code Dashboard.

Steps:

1. **Find PID files**: Check `~/.claude/dashboard.pid` (global) and `<cwd>/.claude/dashboard.pid` (project).

2. **Read each PID file** — it's JSON like `{ "pid": 1234, "port": 19280, "startedAt": "..." }`.

3. **Kill the process**:
   - Windows: `taskkill //F //PID <pid>`
   - macOS/Linux: `kill <pid>` (or `kill -9 <pid>` if it doesn't exit)

4. **Remove stale PID files** if they remain after killing.

5. **Verify**: Hit `http://127.0.0.1:<port>/api/health`. It should fail (connection refused) — confirm the dashboard is stopped.

If no PID file exists, report "Dashboard is not running" and stop.
