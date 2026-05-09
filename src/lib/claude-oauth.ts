// ---------------------------------------------------------------------------
// Claude OAuth — Token management + Usage API
// Reads credentials from ~/.claude/.credentials.json (cross-platform)
// ---------------------------------------------------------------------------

import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

// ── Types ─────────────────────────────────────────────────────────────────

interface UsageWindow {
  utilization: number;
  resets_at: string;
}

export interface ClaudeUsageData {
  five_hour: UsageWindow;
  seven_day: UsageWindow;
  seven_day_opus: { utilization: number } | null;
}

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// ── Token Cache ───────────────────────────────────────────────────────────

let tokenCache: TokenData | null = null;

function normalizeExpiresAt(v: number): number {
  return v > 1e12 ? Math.floor(v / 1000) : v;
}

async function readCredentials(): Promise<TokenData | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt > nowSec + 60) {
    return tokenCache;
  }

  try {
    const credPath = path.join(homedir(), '.claude', '.credentials.json');
    const raw = await fs.readFile(credPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const oauth = parsed?.claudeAiOauth;
    if (!oauth?.accessToken || !oauth?.refreshToken) return null;

    const cached: TokenData = {
      accessToken: oauth.accessToken,
      refreshToken: oauth.refreshToken,
      expiresAt: normalizeExpiresAt(oauth.expiresAt ?? 0),
    };
    tokenCache = cached;
    return cached;
  } catch {
    return null;
  }
}

// ── Token Refresh ─────────────────────────────────────────────────────────

async function refreshToken(refreshToken: string): Promise<TokenData | null> {
  try {
    const res = await fetch('https://api.anthropic.com/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) return null;

    const json = await res.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const newToken: TokenData = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + json.expires_in,
    };
    tokenCache = newToken;
    return newToken;
  } catch {
    return null;
  }
}

// ── Usage API ─────────────────────────────────────────────────────────────

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const BETA_HEADER = 'oauth-2025-04-20';

// Cache (30 seconds)
let usageCache: { data: ClaudeUsageData; expiry: number } | null = null;

async function fetchUsageWithToken(accessToken: string): Promise<ClaudeUsageData | null> {
  const res = await fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'anthropic-beta': BETA_HEADER,
    },
  });

  if (!res.ok) return null;

  const json = await res.json() as ClaudeUsageData;
  if (typeof json.five_hour?.utilization !== 'number') return null;
  return json;
}

export async function getClaudeUsage(): Promise<ClaudeUsageData | null> {
  // Check cache
  if (usageCache && usageCache.expiry > Date.now()) {
    return usageCache.data;
  }

  let token = await readCredentials();
  if (!token) return null;

  // Refresh if expired
  const nowSec = Math.floor(Date.now() / 1000);
  if (token.expiresAt < nowSec + 60) {
    const refreshed = await refreshToken(token.refreshToken);
    if (!refreshed) return null;
    token = refreshed;
  }

  // Try fetch
  let data = await fetchUsageWithToken(token.accessToken);

  // 401 → refresh and retry once
  if (!data) {
    const refreshed = await refreshToken(token.refreshToken);
    if (!refreshed) return null;
    data = await fetchUsageWithToken(refreshed.accessToken);
  }

  if (data) {
    usageCache = { data, expiry: Date.now() + 30_000 };
  }
  return data;
}

export async function isOAuthAvailable(): Promise<boolean> {
  const token = await readCredentials();
  return token !== null;
}
