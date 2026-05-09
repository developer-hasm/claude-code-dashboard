import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getGlobalPath } from '@/lib/server-state';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  toolCalls?: number;
  tokens?: { input: number; output: number };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;

  try {
    const globalPath = getGlobalPath();
    const projectsDir = path.join(globalPath, 'projects');

    // Find the JSONL file for this session
    let jsonlContent = '';
    try {
      const projDirs = await fs.readdir(projectsDir);
      for (const dir of projDirs) {
        // Check direct file
        const jsonlPath = path.join(projectsDir, dir, `${sessionId}.jsonl`);
        try {
          jsonlContent = await fs.readFile(jsonlPath, 'utf-8');
          break;
        } catch { /* not in this dir */ }
        // Check subdirectory (for resumed sessions)
        const subDir = path.join(projectsDir, dir, sessionId);
        try {
          const subFiles = await fs.readdir(subDir);
          const mainJsonl = subFiles.find(f => f.endsWith('.jsonl') && !f.includes('subagent'));
          if (mainJsonl) {
            jsonlContent = await fs.readFile(path.join(subDir, mainJsonl), 'utf-8');
            break;
          }
        } catch { /* no subdir */ }
      }
    } catch { /* projects dir missing */ }

    if (!jsonlContent) {
      return NextResponse.json({ result: false, code: 'NOT_FOUND', message: 'Session JSONL not found' }, { status: 404 });
    }

    const lines = jsonlContent.split('\n').filter(l => l.trim());
    const messages: ChatMessage[] = [];

    for (const line of lines) {
      try {
        const msg = JSON.parse(line);

        if (msg.type === 'user' && msg.message?.role === 'user') {
          const c = msg.message.content;
          let text = typeof c === 'string' ? c
            : Array.isArray(c) ? c.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n') : '';
          // Strip system XML tags for readability
          text = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
          text = text.replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '').trim();
          if (text) {
            messages.push({
              role: 'user',
              content: text.slice(0, 2000),
              timestamp: msg.timestamp,
            });
          }
        }

        if (msg.type === 'assistant' && msg.message) {
          const content = msg.message.content;
          let text = '';
          let toolCalls = 0;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text') text += (text ? '\n' : '') + block.text;
              if (block.type === 'tool_use') toolCalls++;
            }
          } else if (typeof content === 'string') {
            text = content;
          }

          const usage = msg.message.usage ?? msg.usage;
          if (!text.trim()) continue; // Skip tool-only or empty messages
          messages.push({
            role: 'assistant',
            content: text.slice(0, 2000),
            timestamp: msg.timestamp,
            toolCalls: toolCalls || undefined,
            tokens: usage ? {
              input: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
              output: usage.output_tokens ?? 0,
            } : undefined,
          });
        }
      } catch { /* skip */ }
    }

    return NextResponse.json({ result: true, data: { sessionId, messages, totalMessages: messages.length } });
  } catch (err) {
    return NextResponse.json(
      { result: false, code: 'LOAD_FAILED', message: err instanceof Error ? err.message : 'Failed to load session' },
      { status: 500 },
    );
  }
}
