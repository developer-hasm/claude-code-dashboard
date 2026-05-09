---
description: Open the Claude Code Dashboard (starts server if needed; cold-start also checks for new releases)
---

Open the Claude Code Dashboard. This command is idempotent — running it again just brings the browser to the existing dashboard.

The plugin's install path is available as `${CLAUDE_PLUGIN_ROOT}`. The server itself handles the "already running" case (PID detection, health check, browser-open-and-exit).

## Hot path (server already running) — must stay sub-second

1. **Quick local health probe** (no network):
   - Read `~/.claude/dashboard.pid` (global) and `<cwd>/.claude/dashboard.pid` (project), if either exists.
   - For each, parse the JSON to get `port`, then `curl -fsS --max-time 1 http://127.0.0.1:<port>/api/health`.
   - If a probe returns `{"ok":true,...}`, this is the hot path:
     - Run `node "${CLAUDE_PLUGIN_ROOT}/server.mjs"` (no `--no-open`). `server.mjs` will detect the running instance, open the browser, and exit in <1s.
     - Print the URL and STOP. **Do NOT run the version check, build, or anything else on the hot path** — this preserves the sub-second re-open experience.

## Cold path (server not running)

2. **Build if missing** (one-time, ~1 minute):
   - Track whether you ran the build. Call this `BUILT_NOW`.
   - If `${CLAUDE_PLUGIN_ROOT}/.next/standalone/server.js` does NOT exist:
     - `cd "${CLAUDE_PLUGIN_ROOT}" && npm install --no-audit --no-fund`
     - `cd "${CLAUDE_PLUGIN_ROOT}" && npm run build` (the project's own `npm run build` ensures the better-sqlite3 binding via `ensure-sqlite-binding` and `scripts/postbuild.mjs` — exit code is trustworthy)
     - Set `BUILT_NOW = true`.
   - **Defensive check — only when `BUILT_NOW` is FALSE** (i.e. we're reusing an existing build that may predate the postbuild script). The fresh-build path's exit code is already authoritative; re-checking adds a wasted `node -e` subprocess on every cold start. Use a cross-platform existence check (no shell `~` expansion):
     ```
     node -e "process.exit(require('fs').existsSync(process.argv[1])?0:1)" "${CLAUDE_PLUGIN_ROOT}/.next/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
     ```
     If this exits non-zero on the reused-build path, the bundle is stale (built before this project's postbuild script existed, or has been partially deleted). Recover by re-running:
     - `cd "${CLAUDE_PLUGIN_ROOT}" && npm rebuild better-sqlite3`
     - `cd "${CLAUDE_PLUGIN_ROOT}" && npm run build`
   - **If `npm run build` itself exits non-zero in either path, STOP**: print the error and the log file path (`${CLAUDE_PLUGIN_ROOT}/dashboard.log`) and do NOT proceed to step 3. The server would technically start, but every DB-backed API would throw `Could not locate the bindings file`, leaving the dashboard silently empty.

3. **Run the server** (do NOT pass `--no-open`):
   - On Windows: `powershell -Command "Start-Process -FilePath 'node' -ArgumentList '${CLAUDE_PLUGIN_ROOT}/server.mjs' -WindowStyle Hidden -RedirectStandardOutput '${CLAUDE_PLUGIN_ROOT}/dashboard.log' -RedirectStandardError '${CLAUDE_PLUGIN_ROOT}/dashboard.err'"`
   - On macOS/Linux: `nohup node "${CLAUDE_PLUGIN_ROOT}/server.mjs" > "${CLAUDE_PLUGIN_ROOT}/dashboard.log" 2>&1 &`

4. **Confirm health** (bounded budget):
   - Poll `http://127.0.0.1:19280/api/health` (try 19280-19289 in order) up to **15 attempts with 1s delay between** (15s total budget).
   - Once any port responds `{"ok":true}`, print the URL.
   - If no port responds within budget, print the failure message and the last 30 lines of `${CLAUDE_PLUGIN_ROOT}/dashboard.log`, then stop.

5. **Version check** (best-effort, AFTER dashboard is up — never blocks startup):
   - Read local version: `node -e "console.log(require('${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json').version)"`.
   - Fetch + parse + validate remote version in one cross-platform pipe (avoids bash-only `<<<` here-strings — works in bash, zsh, PowerShell, and cmd because everything uses `|`):
     ```
     curl -fsSL --connect-timeout 2 --max-time 5 https://raw.githubusercontent.com/developer-hasm/claude-code-dashboard/main/.claude-plugin/plugin.json | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));const v=j.version;if(!/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(v))process.exit(1);console.log(v)"
     ```
     If this command exits non-zero or prints nothing, treat as fetch failure and silently skip.
     (Keep the URL in sync with `commands/update.md`.)
   - **SemVer compare** with a three-valued one-liner (do NOT use string/lexical compare — `1.10.0` is greater than `1.2.0`):
     ```
     node -e "const c=(a,b)=>{const [A,B]=[a,b].map(s=>s.replace(/[+-].*/,'').split('.').map(Number));for(let i=0;i<3;i++)if(A[i]!==B[i])return A[i]<B[i]?-1:1;return 0};const r=c(process.argv[1],process.argv[2]);console.log(r>0?'gt':r<0?'lt':'eq')" "<REMOTE>" "<LOCAL>"
     ```
     **Substitute `<REMOTE>` and `<LOCAL>` with the literal version strings captured above** (e.g. `"1.10.0"` `"1.2.0"`). Do NOT rely on shell variable expansion — variable syntax differs between bash (`$REMOTE`), PowerShell (`$REMOTE`), and cmd (`%REMOTE%`); literal substitution by the agent works in all of them. Branch on the literal output `gt` / `eq` / `lt`.
   - **Three cases**:
     - `gt` (remote > local) → print exactly:
       ```
       📦 Update available: <local> → <remote>
          To update, run /claude-code-dashboard:update
          (this dashboard will keep working on the current version until you do)
       ```
     - `eq` (remote == local) → silent (no notice).
     - `lt` (remote < local) → silent (user is on a dev/ahead build).
   - **On any error** (no network, GitHub unreachable, malformed JSON, regex mismatch): silently skip. Do NOT print warnings, do NOT block.

If steps 2-4 fail, surface the error and the log file path: `${CLAUDE_PLUGIN_ROOT}/dashboard.log`.
