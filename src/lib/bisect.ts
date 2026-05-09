// ---------------------------------------------------------------------------
// Claude Code Dashboard Plugin — Extension Bisect (Binary Search Debugging)
// ---------------------------------------------------------------------------

import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

import {
  BisectItem,
  BisectRound,
  BisectSession,
  BisectResponse,
  DashboardItem,
  ItemCategory,
} from './types';
import { safeModifySettings, atomicWriteJson } from './settings-mutex';

// ── Constants ─────────────────────────────────────────────────────────────

const SESSION_PATH = path.join(homedir(), '.claude', 'dashboard-bisect-session.json');
const BISECTABLE_CATEGORIES = new Set<ItemCategory>([
  ItemCategory.PLUGIN,
  ItemCategory.HOOK,
]);

type BisectState =
  | 'IDLE'
  | 'STARTED'
  | 'TESTING'
  | 'WAITING_FEEDBACK'
  | 'NARROWING'
  | 'FOUND'
  | 'RESTORED';

interface InternalSession {
  sessionId: string;
  state: BisectState;
  items: BisectItem[];
  suspects: string[]; // ids of currently suspected items
  rounds: BisectRound[];
  settingsSnapshot: string; // JSON string of original settings
  settingsPath: string;
  suspectedItem: string | null;
  startedAt: string;
}

// ── Persistence ───────────────────────────────────────────────────────────

async function loadSession(): Promise<InternalSession | null> {
  try {
    const raw = await fs.readFile(SESSION_PATH, 'utf-8');
    return JSON.parse(raw) as InternalSession;
  } catch {
    return null;
  }
}

async function saveSession(session: InternalSession): Promise<void> {
  await fs.mkdir(path.dirname(SESSION_PATH), { recursive: true });
  await atomicWriteJson(SESSION_PATH, session);
}

async function clearSession(): Promise<void> {
  try {
    await fs.unlink(SESSION_PATH);
  } catch { /* ignore */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function toPublicSession(s: InternalSession): BisectSession {
  return {
    sessionId: s.sessionId,
    status: s.state === 'FOUND' || s.state === 'RESTORED'
      ? 'completed'
      : s.state === 'IDLE'
        ? 'cancelled'
        : 'in_progress',
    items: s.items,
    rounds: s.rounds,
    suspectedItem: s.suspectedItem,
    startedAt: s.startedAt,
  };
}

function splitHalf(ids: string[]): { disabled: string[]; enabled: string[] } {
  const mid = Math.ceil(ids.length / 2);
  return {
    disabled: ids.slice(0, mid),
    enabled: ids.slice(mid),
  };
}

async function applyDisabledSet(session: InternalSession, disabledIds: Set<string>): Promise<void> {
  await safeModifySettings<Record<string, unknown>>(session.settingsPath, (data) => {
    // Handle plugins: set enabled=false for disabled ones
    for (const item of session.items) {
      if (item.category === ItemCategory.PLUGIN) {
        const plugins = (data.enabledPlugins ?? {}) as Record<string, boolean>;
        plugins[item.name] = !disabledIds.has(item.id);
        data.enabledPlugins = plugins;
      }
    }

    // Handle hooks: remove disabled hooks from settings
    const snapshot = JSON.parse(session.settingsSnapshot) as Record<string, unknown>;
    const originalHooks = (snapshot.hooks ?? {}) as Record<string, unknown[]>;
    const currentHooks: Record<string, unknown[]> = {};

    for (const item of session.items) {
      if (item.category !== ItemCategory.HOOK) continue;
      if (disabledIds.has(item.id)) continue; // skip disabled

      // Re-add this hook from snapshot
      for (const [event, hookList] of Object.entries(originalHooks)) {
        for (const hook of hookList) {
          const h = hook as Record<string, unknown>;
          // Match by name (which is event:command for hooks)
          if (`${event}:${h.command}` === item.name || event === item.name) {
            if (!currentHooks[event]) currentHooks[event] = [];
            currentHooks[event].push(hook);
          }
        }
      }
    }

    data.hooks = currentHooks;
    return data;
  });
}

async function restoreSettings(session: InternalSession): Promise<void> {
  const original = JSON.parse(session.settingsSnapshot);
  await atomicWriteJson(session.settingsPath, original);
}

// ── Public API ────────────────────────────────────────────────────────────

export async function startBisect(
  items: DashboardItem[],
  settingsPath: string,
): Promise<BisectResponse> {
  const existing = await loadSession();
  if (existing && existing.state !== 'IDLE' && existing.state !== 'FOUND' && existing.state !== 'RESTORED') {
    throw new Error('A bisect session is already in progress. Abort it first.');
  }

  // Filter to bisectable categories
  const bisectable = items.filter(i => BISECTABLE_CATEGORIES.has(i.category));
  if (bisectable.length === 0) {
    throw new Error('No plugins or hooks found to bisect.');
  }

  // Snapshot current settings
  let settingsRaw: string;
  try {
    settingsRaw = await fs.readFile(settingsPath, 'utf-8');
  } catch {
    settingsRaw = '{}';
  }

  const bisectItems: BisectItem[] = bisectable.map(i => ({
    id: i.id,
    category: i.category,
    name: i.name,
    enabled: true,
  }));

  const suspects = bisectable.map(i => i.id);
  const { disabled, enabled } = splitHalf(suspects);

  const round: BisectRound = {
    roundNumber: 1,
    enabledItems: enabled,
    disabledItems: disabled,
    userVerdict: null,
  };

  const session: InternalSession = {
    sessionId: randomUUID(),
    state: 'WAITING_FEEDBACK',
    items: bisectItems,
    suspects,
    rounds: [round],
    settingsSnapshot: settingsRaw,
    settingsPath,
    suspectedItem: null,
    startedAt: new Date().toISOString(),
  };

  // Disable half
  await applyDisabledSet(session, new Set(disabled));
  await saveSession(session);

  return {
    session: toPublicSession(session),
    currentRound: round,
    message: `Bisect started. ${bisectable.length} items under investigation. Disabled ${disabled.length} items. Please test and report whether the problem still occurs.`,
  };
}

export async function processFeedback(reproduced: boolean): Promise<BisectResponse> {
  const session = await loadSession();
  if (!session || session.state !== 'WAITING_FEEDBACK') {
    throw new Error('No bisect session waiting for feedback.');
  }

  const currentRound = session.rounds[session.rounds.length - 1];
  currentRound.userVerdict = reproduced ? 'bad' : 'good';

  // Narrow suspects
  if (reproduced) {
    // Problem reproduced with disabled set removed → problem is in the ENABLED set
    session.suspects = currentRound.enabledItems;
  } else {
    // Problem NOT reproduced → problem is in the DISABLED set
    session.suspects = currentRound.disabledItems;
  }

  // Check if we found the culprit
  if (session.suspects.length <= 1) {
    session.state = 'FOUND';
    session.suspectedItem = session.suspects[0] ?? null;

    // Restore original settings
    await restoreSettings(session);
    session.state = 'RESTORED';
    await saveSession(session);

    const foundItem = session.items.find(i => i.id === session.suspectedItem);
    const name = foundItem ? `${foundItem.category}:${foundItem.name}` : 'unknown';

    return {
      session: toPublicSession(session),
      currentRound: null,
      message: `Bisect complete! Suspected problematic item: ${name}. Settings have been restored.`,
    };
  }

  // Continue bisecting
  const { disabled, enabled } = splitHalf(session.suspects);
  const newRound: BisectRound = {
    roundNumber: session.rounds.length + 1,
    enabledItems: enabled,
    disabledItems: disabled,
    userVerdict: null,
  };

  session.rounds.push(newRound);
  session.state = 'WAITING_FEEDBACK';

  // Apply new disabled set — start from snapshot and only enable suspects' enabled half
  const allDisabled = new Set(session.items.map(i => i.id));
  for (const id of enabled) allDisabled.delete(id);
  // Also keep non-suspect items in their original state (enabled)
  for (const item of session.items) {
    if (!session.suspects.includes(item.id) && !disabled.includes(item.id)) {
      // Items not in suspects at all should remain enabled
    }
  }
  // Actually: disable all suspects except the enabled half, keep non-suspects enabled
  const toDisable = new Set(disabled);
  // Also disable suspects not in the enabled half (all suspects not in enabled)
  for (const id of session.suspects) {
    if (!enabled.includes(id)) {
      toDisable.add(id);
    }
  }
  await applyDisabledSet(session, toDisable);
  await saveSession(session);

  return {
    session: toPublicSession(session),
    currentRound: newRound,
    message: `Round ${newRound.roundNumber}: ${session.suspects.length} suspects remaining. Disabled ${disabled.length} items. Please test again.`,
  };
}

export async function abortBisect(): Promise<BisectResponse> {
  const session = await loadSession();
  if (!session) {
    throw new Error('No bisect session to abort.');
  }

  // Restore original settings
  await restoreSettings(session);
  session.state = 'RESTORED';

  const publicSession = toPublicSession(session);
  publicSession.status = 'cancelled';

  await clearSession();

  return {
    session: publicSession,
    currentRound: null,
    message: 'Bisect session cancelled. Settings have been restored to their original state.',
  };
}

export async function getBisectSession(): Promise<BisectSession | null> {
  const session = await loadSession();
  if (!session) return null;
  return toPublicSession(session);
}
