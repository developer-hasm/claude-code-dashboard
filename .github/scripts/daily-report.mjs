#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Daily Ops Report — runs from .github/workflows/daily-ops.yml
//
// Collects current repo metrics and writes a markdown summary to
// reports/YYYY-MM-DD.md. State is persisted in reports/.state.json so
// next-day deltas (stars +N, etc.) can be shown.
//
// Required env: GITHUB_TOKEN, REPO (owner/name), OWNER.
// Endpoints that require push access (traffic) are wrapped in try/catch and
// fall through to "n/a" if permissions are missing.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.REPO;     // e.g. "developer-hasm/claude-code-dashboard"
const OWNER = process.env.OWNER;   // e.g. "developer-hasm"

if (!TOKEN || !REPO || !OWNER) {
  console.error('Missing required env: GITHUB_TOKEN, REPO, OWNER');
  process.exit(1);
}

// ── HTTP helper ──────────────────────────────────────────────────────────

async function gh(path, { accept } = {}) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: accept ?? 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'developer-hasm-daily-ops',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`GitHub API ${path}: ${res.status} ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function ghOrNull(path, opts) {
  try {
    return await gh(path, opts);
  } catch (e) {
    console.warn(`[daily-report] skipped ${path}: ${e.message}`);
    return null;
  }
}

// ── Collect metrics ──────────────────────────────────────────────────────

const repoData = await gh(`repos/${REPO}`);
const traffic = await ghOrNull(`repos/${REPO}/traffic/views`);
const clones = await ghOrNull(`repos/${REPO}/traffic/clones`);

// Issues endpoint also returns PRs (in GitHub's data model). Filter manually.
const recentIssuesRaw = await gh(
  `repos/${REPO}/issues?state=all&sort=updated&direction=desc&per_page=20`,
);
const openPRs = await gh(`repos/${REPO}/pulls?state=open&per_page=100`);

const recentIssues = recentIssuesRaw.filter((i) => !i.pull_request);

// ── State diff ───────────────────────────────────────────────────────────

const reportDir = 'reports';
fs.mkdirSync(reportDir, { recursive: true });

const stateFile = path.join(reportDir, '.state.json');
let prevState = null;
if (fs.existsSync(stateFile)) {
  try {
    prevState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    /* corrupted — ignore */
  }
}

const stars = repoData.stargazers_count;
const forks = repoData.forks_count;
const watchers = repoData.subscribers_count;
const openIssuesCount = recentIssues.filter((i) => i.state === 'open').length;
const openPRsCount = openPRs.length;

const currentState = { date: today(), stars, forks, watchers, openIssuesCount, openPRsCount };

function delta(now, prev) {
  if (prev == null) return String(now);
  const d = now - prev;
  if (d === 0) return `${now}  (±0)`;
  return `${now}  (${d > 0 ? '+' : ''}${d})`;
}

// ── Issues needing first maintainer reply ────────────────────────────────

const needsReply = recentIssues.filter((i) => {
  if (i.state !== 'open') return false;
  if (i.user.login === OWNER) return false; // self-opened
  return i.comments === 0;
});

// ── Render report ────────────────────────────────────────────────────────

const t = today();

const md = [
  `# Daily Ops — ${t}`,
  ``,
  `**Repo**: [${REPO}](https://github.com/${REPO})`,
  ``,
  `## Snapshot`,
  ``,
  `| Metric | Today |`,
  `|--------|-------|`,
  `| ⭐ Stars | ${delta(stars, prevState?.stars)} |`,
  `| 🍴 Forks | ${delta(forks, prevState?.forks)} |`,
  `| 👀 Watchers | ${delta(watchers, prevState?.watchers)} |`,
  `| 🐛 Open issues | ${delta(openIssuesCount, prevState?.openIssuesCount)} |`,
  `| 🔀 Open PRs | ${delta(openPRsCount, prevState?.openPRsCount)} |`,
  ``,
  `## Traffic (GitHub-provided 14-day window)`,
  ``,
  traffic
    ? `- Views: ${traffic.count} (${traffic.uniques} unique)`
    : `- Views: _unavailable_`,
  clones
    ? `- Clones: ${clones.count} (${clones.uniques} unique)`
    : `- Clones: _unavailable_`,
  ``,
  `## Action items`,
  ``,
  `### Issues needing first reply (${needsReply.length})`,
  ``,
  needsReply.length === 0
    ? `_All caught up._`
    : needsReply
        .map(
          (i) =>
            `- [#${i.number}](${i.html_url}) ${escapeMd(i.title)} — by @${i.user.login} on ${i.created_at.slice(0, 10)}`,
        )
        .join('\n'),
  ``,
  `### Recently updated (top 5)`,
  ``,
  recentIssues.length === 0
    ? `_No recent activity._`
    : recentIssues
        .slice(0, 5)
        .map(
          (i) =>
            `- [#${i.number}](${i.html_url}) ${escapeMd(i.title)} (${i.state}, updated ${i.updated_at.slice(0, 10)})`,
        )
        .join('\n'),
  ``,
  `---`,
  `_Auto-generated by .github/workflows/daily-ops.yml_`,
  ``,
].join('\n');

fs.writeFileSync(path.join(reportDir, `${t}.md`), md);
fs.writeFileSync(stateFile, JSON.stringify(currentState, null, 2) + '\n');

console.log(`✓ Wrote reports/${t}.md`);

// ── Helpers ──────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeMd(s) {
  return String(s).replace(/[|`*_\[\]<>]/g, (c) => `\\${c}`);
}
