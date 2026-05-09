import fs from 'node:fs/promises';
import path from 'node:path';

const mutex = new Map<string, Promise<void>>();

export async function withSettingsLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const prev = mutex.get(filePath) ?? Promise.resolve();
  let resolve: () => void;
  const gate = new Promise<void>(r => { resolve = r; });
  mutex.set(filePath, gate);
  await prev;
  try {
    return await fn();
  } finally {
    resolve!();
    if (mutex.get(filePath) === gate) mutex.delete(filePath);
  }
}

export async function drainMutex(timeoutMs = 5000): Promise<void> {
  await Promise.race([
    Promise.all([...mutex.values()]),
    new Promise(resolve => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const tmpPath = filePath + '.tmp';
  const content = JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(tmpPath, content, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function safeModifySettings<T extends object>(filePath: string, modifier: (data: T) => T, fallback?: T): Promise<void> {
  await withSettingsLock(filePath, async () => {
    let data: T;
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      data = JSON.parse(raw) as T;
    } catch {
      if (fallback !== undefined) {
        data = fallback;
      } else {
        throw new Error(`Settings file not found or unreadable: ${filePath}`);
      }
    }
    const modified = modifier(structuredClone(data));
    await atomicWriteJson(filePath, modified);
  });
}
