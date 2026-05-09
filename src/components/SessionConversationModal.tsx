'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  toolCalls?: number;
  tokens?: { input: number; output: number };
}

interface SessionConversationModalProps {
  sessionId: string | null;
  onClose: () => void;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function SessionConversationModal({ sessionId, onClose }: SessionConversationModalProps) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    setMessages([]);

    (async () => {
      try {
        const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`);
        const json = await res.json();
        if (json.result && json.data?.messages) {
          setMessages(json.data.messages);
        } else {
          setError(json.message || 'Failed to load conversation');
        }
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!sessionId) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sessionId, handleKeyDown]);

  if (!sessionId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="modal-enter"
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          width: 'calc(100% - 32px)',
          maxWidth: 780,
          maxHeight: 'calc(100vh - 64px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--border) 0px 0px 0px 1px, rgba(0,0,0,0.1) 0px 8px 24px',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-strong)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              대화 내용
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {sessionId.slice(0, 12)}... · {messages.length} messages
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-tertiary)', padding: 4, fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>

        {/* Message list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
              Loading conversation...
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--danger)', fontSize: 13 }}>
              {error}
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
              No messages found
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '10px 14px',
              borderRadius: 8,
              background: msg.role === 'user' ? 'var(--accent-subtle)' : 'var(--bg)',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              minWidth: '40%',
            }}>
              {/* Role label */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                color: msg.role === 'user' ? 'var(--accent)' : 'var(--text-tertiary)',
                letterSpacing: '0.5px',
              }}>
                {msg.role === 'user' ? 'You' : 'Claude'}
                {msg.toolCalls ? (
                  <span style={{
                    fontWeight: 400, textTransform: 'none', letterSpacing: 0,
                    color: 'var(--text-tertiary)', fontSize: 11,
                  }}>
                    + {msg.toolCalls} tool call{msg.toolCalls > 1 ? 's' : ''}
                  </span>
                ) : null}
                {msg.tokens ? (
                  <span style={{
                    fontWeight: 400, textTransform: 'none', letterSpacing: 0,
                    color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-mono)',
                  }}>
                    {formatTokens(msg.tokens.input + msg.tokens.output)} tok
                  </span>
                ) : null}
              </div>

              {/* Content */}
              <div style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {msg.content.length > 500
                  ? msg.content.slice(0, 500) + '...'
                  : msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
