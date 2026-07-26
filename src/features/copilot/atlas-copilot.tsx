'use client';

import * as React from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { askAtlas, type AtlasMessage } from './actions';
import { cn } from '@/lib/utils';

export interface AtlasLabels {
  title: string;
  subtitle: string;
  open: string;
  close: string;
  placeholder: string;
  send: string;
  greeting: string;
  error: string;
}

// Atlas — floating AI copilot available across the authenticated app. Advisory
// only; the heavy lifting (and key handling) is in the askAtlas server action.
// `raised` lifts the launcher above the participant QuickActions speed-dial so
// the two FABs don't overlap.
export function AtlasCopilot({
  enabled,
  raised = false,
  labels,
}: {
  enabled: boolean;
  raised?: boolean;
  labels: AtlasLabels;
}) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<AtlasMessage[]>([
    { role: 'assistant', content: labels.greeting },
  ]);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Keep the latest message in view.
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    const next: AtlasMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setPending(true);
    try {
      const res = await askAtlas({ history: next.slice(-20) });
      const reply = res.ok ? res.data.reply : `${labels.error} ${res.error.message}`;
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: labels.error }]);
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (!enabled) return null;

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          type="button"
          aria-label={labels.open}
          onClick={() => setOpen(true)}
          className={cn(
            'fixed right-6 z-40 flex size-14 items-center justify-center rounded-full border border-green-strong bg-green text-white transition-colors duration-150 hover:bg-green-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/40 motion-reduce:transition-none',
            raised ? 'bottom-24' : 'bottom-6',
          )}
        >
          <Sparkles className="size-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label={labels.title}
          className="fixed inset-x-4 bottom-4 z-50 flex h-[32rem] max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-border bg-surface sm:inset-x-auto sm:right-6 sm:w-[24rem]"
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border bg-green px-4 py-3 text-white">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-small font-semibold">{labels.title}</p>
              <p className="truncate text-micro text-white/80">{labels.subtitle}</p>
            </div>
            <button
              type="button"
              aria-label={labels.close}
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-white/90 hover:bg-white/15"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-small',
                    m.role === 'user'
                      ? 'bg-green text-white'
                      : 'bg-surface-2 text-ink',
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-small text-ink-2">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={labels.placeholder}
                className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-md border border-border bg-bg px-3 py-2 text-small text-ink placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/30"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={pending || input.trim() === ''}
                aria-label={labels.send}
                className="flex size-10 shrink-0 items-center justify-center rounded-md bg-green text-white transition-colors hover:bg-green-strong disabled:opacity-50"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
