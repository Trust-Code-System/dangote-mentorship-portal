'use client';

import * as React from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { askAtlas, type AtlasMessage } from './actions';
import { cn } from '@/lib/utils';
import { SoftPanel } from '@/components/motion/soft-panel';

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
            'border-green-strong bg-green hover:bg-green-strong focus-visible:ring-green/40 fixed right-6 z-40 flex size-14 items-center justify-center rounded-full border text-white transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none',
            raised ? 'bottom-24' : 'bottom-6',
          )}
        >
          <Sparkles className="size-6" />
        </button>
      )}

      {/* Panel */}
      <SoftPanel
        open={open}
        role="dialog"
        aria-label={labels.title}
        className="border-border bg-surface fixed inset-x-4 bottom-4 z-50 flex h-[32rem] max-h-[80vh] flex-col overflow-hidden rounded-2xl border sm:inset-x-auto sm:right-6 sm:w-[24rem]"
      >
        {/* Header */}
        <div className="border-border bg-green flex items-center gap-3 border-b px-4 py-3 text-white">
          <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-small font-semibold">{labels.title}</p>
            <p className="text-micro truncate text-white/80">{labels.subtitle}</p>
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
                  'text-small max-w-[85%] min-w-0 rounded-2xl px-3 py-2 [overflow-wrap:anywhere] whitespace-pre-line',
                  m.role === 'user' ? 'bg-green text-white' : 'bg-surface-2 text-ink',
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-start">
              <div className="bg-surface-2 text-small text-ink-2 flex items-center gap-2 rounded-2xl px-3 py-2">
                <Loader2 className="size-4 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-border border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={labels.placeholder}
              className="border-border bg-bg text-small text-ink placeholder:text-ink-3 focus-visible:ring-green/30 max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-md border px-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={pending || input.trim() === ''}
              aria-label={labels.send}
              className="bg-green hover:bg-green-strong flex size-10 shrink-0 items-center justify-center rounded-md text-white transition-colors disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      </SoftPanel>
    </>
  );
}
