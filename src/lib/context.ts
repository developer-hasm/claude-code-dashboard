import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface ExecutionContext {
  projectPath: string | null;  // null when running in global context
  globalPath: string;          // ~/.claude
}

export function detectContext(startDir?: string): ExecutionContext {
  const globalPath = path.join(homedir(), '.claude');
  const cwd = startDir || process.cwd();

  // Walk up from cwd looking for .claude/ directory
  let dir = path.resolve(cwd);
  while (true) {
    const claudeDir = path.join(dir, '.claude');
    // Must be exactly .claude/ directory with agents/, skills/, or settings.json inside
    // (not .claude-plugin/ or similar)
    if (existsSync(claudeDir) && !claudeDir.includes('.claude-plugin')) {
      const hasAgents = existsSync(path.join(claudeDir, 'agents'));
      const hasSkills = existsSync(path.join(claudeDir, 'skills'));
      const hasCommands = existsSync(path.join(claudeDir, 'commands'));
      const hasCLAUDE_MD = existsSync(path.join(dir, 'CLAUDE.md'));
      // Require actual project content — settings.json alone is not enough
      if (hasAgents || hasSkills || hasCommands || hasCLAUDE_MD) {
        return { projectPath: dir, globalPath };
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached root
    dir = parent;
  }

  return { projectPath: null, globalPath };
}

// Expand environment variables in hook command paths
export function expandEnvVars(command: string, projectPath: string | null): string {
  let result = command;
  if (projectPath) {
    result = result.replace(/\$CLAUDE_PROJECT_DIR/g, projectPath);
    result = result.replace(/"\$CLAUDE_PROJECT_DIR"/g, projectPath); // handle quoted form
  }
  result = result.replace(/\$HOME/g, homedir());
  result = result.replace(/~/g, homedir());
  // Remove surrounding quotes from paths
  result = result.replace(/^"(.*)"$/, '$1');
  return result;
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

export function getScanRoots(ctx: ExecutionContext): { projectRoot: string | null; globalRoot: string } {
  return {
    projectRoot: ctx.projectPath ? path.join(ctx.projectPath, '.claude') : null,
    globalRoot: ctx.globalPath,
  };
}
