---
description: Show Claude Code Dashboard status (running/stopped, URL, uptime)
---

Check the Claude Code Dashboard status.

Steps:

1. **Find PID files**: Check `~/.claude/dashboard.pid` (global) and `<cwd>/.claude/dashboard.pid` (project).

2. **For each PID file found**:
   - Parse JSON: `{ pid, port, startedAt }`
   - Hit `http://127.0.0.1:<port>/api/health` — expect `{ ok: true, uptime: <seconds> }`
   - If healthy, this is a live server.

3. **Report a table** with these columns: `scope` (global/project), `port`, `pid`, `startedAt`, `uptime` (formatted: `1h 23m`), `url`.

4. **If no live servers found**, print "No dashboard running. Use `/claude-code-dashboard:open` to launch."

Keep the output concise — under 10 lines.
