---
description: Update the Claude Code Dashboard plugin to the latest released version
---

Update the Claude Code Dashboard plugin via the official Claude Code plugin CLI.

> ⚠️ **`${CLAUDE_PLUGIN_ROOT}` becomes stale immediately after step 2.** A successful update relocates the install dir (e.g. `.../1.0.0/` → `.../1.1.0/`), so any subsequent step in this command MUST NOT touch `${CLAUDE_PLUGIN_ROOT}`. Server relaunch happens later, in a fresh `:open` after Claude Code restart.

**Why this is a separate command** (rather than running inside `:open`):
- Plugin update changes the install directory, so the running slash command would have a stale path.
- Slash commands themselves are loaded once per Claude Code session — new commands or descriptions won't appear until restart.
- Doing the update in its own command makes the restart requirement obvious.

## Steps

### 1. Show current vs. remote version

- Local: read `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json` and report `version`.
- Fetch + parse + validate remote in one cross-platform pipe (works in bash, zsh, PowerShell, cmd):
  ```
  curl -fsSL --connect-timeout 2 --max-time 5 https://raw.githubusercontent.com/developer-hasm/claude-code-dashboard/main/.claude-plugin/plugin.json | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));const v=j.version;if(!/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(v))process.exit(1);console.log(v)"
  ```
  *(Keep URL in sync with `commands/open.md`.)*
  If this command exits non-zero or prints nothing, print `⚠️ Could not fetch a valid manifest from GitHub. Try again later.` and stop.
- **SemVer compare** with a three-valued one-liner (do NOT use string/lexical compare — `1.10.0` is greater than `1.2.0`):
  ```
  node -e "const c=(a,b)=>{const [A,B]=[a,b].map(s=>s.replace(/[+-].*/,'').split('.').map(Number));for(let i=0;i<3;i++)if(A[i]!==B[i])return A[i]<B[i]?-1:1;return 0};const r=c(process.argv[1],process.argv[2]);console.log(r>0?'gt':r<0?'lt':'eq')" "<REMOTE>" "<LOCAL>"
  ```
  **Substitute `<REMOTE>` and `<LOCAL>` with the literal version strings captured above** (e.g. `"1.10.0"` `"1.2.0"`). Do NOT rely on shell variable expansion — variable syntax differs between bash (`$REMOTE`), PowerShell (`$REMOTE`), and cmd (`%REMOTE%`); literal substitution by the agent works in all of them. Branch on the literal output `gt` / `eq` / `lt`.
- **Three cases**:
  - `eq` → print `Already at latest version (X.X.X). Nothing to update.` and STOP. Do NOT run the update CLI.
  - `lt` → print `Local version (X) is ahead of remote (Y). Probably a dev build — nothing to update. (Run claude plugin uninstall then install if you really want to revert.)` and STOP.
  - `gt` → print `Updating: X → Y…` and continue.

### 2. Refresh the marketplace cache and apply the update

- `claude plugin marketplace update developer-hasm`
- `claude plugin update claude-code-dashboard@developer-hasm`
- Print the output of each so the user can see what happened. If either errors (non-zero exit), surface the message and stop — do not proceed to step 3.
- After both succeed, verify the new install landed. The expected directory is `~/.claude/plugins/cache/developer-hasm/claude-code-dashboard/<REMOTE>/` (substitute the literal remote version string from step 1 — do NOT lexically sort directory names, since `1.10.0` would sort before `1.2.0` and pick the wrong one). Use a cross-platform check that does not rely on shell `~` expansion:
  ```
  node -e "const fs=require('fs'),path=require('path'),os=require('os');const m=path.join(os.homedir(),'.claude','plugins','cache','developer-hasm','claude-code-dashboard','<REMOTE>','.claude-plugin','plugin.json');try{const v=JSON.parse(fs.readFileSync(m,'utf8')).version;process.exit(v==='<REMOTE>'?0:2)}catch{process.exit(1)}"
  ```
  Substitute both `<REMOTE>` placeholders with the literal version string. Exit 0 = ok, 1 = directory/file missing, 2 = version mismatch. On exit 1 or 2, print `⚠️ Update CLI succeeded but verification of the new install path failed. Marketplace cache may be stale — proceeding anyway. If problems persist, try claude plugin marketplace remove developer-hasm then re-add.` and **continue to step 3** (do not stop — the update may have succeeded; leaving the user in a half-stopped state is worse than continuing).

### 3. Stop any running dashboard server

The old install path's build artifacts are now orphaned and the user is going to relaunch on the new version anyway. **Do not touch `${CLAUDE_PLUGIN_ROOT}` here** (it points at the now-removed old install dir).

For each PID file at `~/.claude/dashboard.pid` (global) and `<cwd>/.claude/dashboard.pid` (project):

1. Parse the file as JSON. Extract `pid` and validate it matches `^[1-9][0-9]*$`. If parse or validation fails, delete the file and skip.
2. **Verify the PID is actually our server** before killing:
   - Windows: `tasklist /FI "PID eq <pid>" /FO CSV /NH` — confirm the image name is `node.exe`.
   - macOS/Linux: `ps -p <pid> -o comm=` — confirm output contains `node`.
   - If verification fails (process is not node, or PID no longer exists), delete the PID file and skip — do NOT kill an unrelated process.
3. **Graceful kill first**:
   - Windows: `taskkill /PID <pid>` (no `/F`).
   - macOS/Linux: `kill <pid>` (SIGTERM, no `-9`).
4. Wait up to 2 seconds. If the process is still alive, escalate to force:
   - Windows: `taskkill /F /PID <pid>`.
   - macOS/Linux: `kill -9 <pid>`.
5. Remove the PID file. If it is already gone (e.g. the server cleaned it up itself on graceful exit), treat that as success — do NOT abort the loop or report an error.

### 4. Tell the user what to do next

Print exactly this block:

```
✅ Update complete.

To start the new version:
  1. Restart Claude Code (so the updated slash commands and plugin path are picked up).
     Without a restart, /claude-code-dashboard:open would still launch the old version's
     server from a stale path.
  2. Run /claude-code-dashboard:open
     (first run on the new version will rebuild — this takes about 1 minute.)
```

Do NOT try to launch the server yourself from this command — the install path has changed and `${CLAUDE_PLUGIN_ROOT}` in this session is now stale.
