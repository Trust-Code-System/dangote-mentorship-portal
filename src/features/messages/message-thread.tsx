'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ArrowLeft, Send } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { loadOlderMessages, sendMessage } from './actions';
import { cn } from '@/lib/utils';
import type { ThreadMessage } from './data';

const NEW_MESSAGE_EVENT = 'message';

export interface ThreadLabels {
  placeholder: string;
  send: string;
  empty: string;
  back: string;
  loadOlder: string;
  sendFailed: string;
  retry: string;
}

// Client thread: renders the message history and a composer. Sends via the
// sendMessage server action with an optimistic append, then refreshes so the
// canonical server state (and read cursors) reconcile.
export function MessageThread({
  conversationId,
  otherName,
  initialMessages,
  initialNextCursor,
  labels,
  realtimeChannel,
}: {
  conversationId: string;
  otherName: string | null;
  initialMessages: ThreadMessage[];
  initialNextCursor: string | null;
  labels: ThreadLabels;
  realtimeChannel: string | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ThreadMessage[]>(initialMessages);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState(initialNextCursor);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const channelRef = React.useRef<RealtimeChannel | null>(null);

  // Supabase Realtime (CLAUDE.md §10). Both participants join a per-conversation
  // Broadcast channel. The payload is a content-free nudge — on receipt we
  // refresh and re-fetch messages through the authorized server route, so
  // message content never travels over the (public) channel. Degrades silently
  // when Supabase isn't configured.
  React.useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase || !realtimeChannel) return;

    let channel: RealtimeChannel | null = null;
    try {
      channel = supabase.channel(realtimeChannel, {
        config: { broadcast: { self: false } },
      });
      channel
        .on('broadcast', { event: NEW_MESSAGE_EVENT }, () => router.refresh())
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') router.refresh();
        });
      channelRef.current = channel;
    } catch {
      // Realtime is best-effort — never crash the thread if the channel fails.
      channelRef.current = null;
      channel = null;
    }

    return () => {
      if (channel) void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [realtimeChannel, router]);

  React.useEffect(() => {
    const reconcile = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) router.refresh();
    };
    const timer = window.setInterval(reconcile, 15_000);
    window.addEventListener('online', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', reconcile);
      document.removeEventListener('visibilitychange', reconcile);
    };
  }, [router]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function submit() {
    const body = input.trim();
    if (!body || pending) return;
    setPending(true);
    setSendError(null);
    // Optimistic append.
    const optimistic: ThreadMessage = {
      id: `tmp-${Date.now()}`,
      mine: true,
      senderName: null,
      body,
      createdAt: new Date(),
    };
    setMessages((m) => [...m, optimistic]);
    setInput('');
    try {
      const res = await sendMessage({ conversationId, body });
      if (!res.ok) {
        // Roll back the optimistic message on failure.
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setInput(body);
        setSendError(res.error.message || labels.sendFailed);
      } else {
        // Nudge the peer to re-fetch (content stays server-gated), then refresh.
        void channelRef.current?.send({
          type: 'broadcast',
          event: NEW_MESSAGE_EVENT,
          payload: {},
        });
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const result = await loadOlderMessages({ conversationId, cursor: nextCursor });
      if (!result.ok) return;
      const older = result.data.messages.map((message) => ({
        ...message,
        createdAt: new Date(message.createdAt),
      }));
      setMessages((current) => [...older, ...current]);
      setNextCursor(result.data.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <section className="flex h-full min-h-[34rem] flex-col overflow-hidden bg-surface">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link
          href="/messages"
          className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2 lg:hidden"
          aria-label={labels.back}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <span className="flex size-9 items-center justify-center rounded-full bg-green-soft text-small font-semibold text-green-strong">
          {(otherName ?? '?').slice(0, 1).toUpperCase()}
        </span>
        <p className="font-display text-h3 font-semibold text-ink">{otherName ?? '—'}</p>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {nextCursor ? (
          <div className="pb-2 text-center">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="rounded-md border border-border px-3 py-1.5 text-small text-ink-2 hover:bg-surface-2 disabled:opacity-50"
            >
              {labels.loadOlder}
            </button>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <p className="py-10 text-center text-small text-ink-3">{labels.empty}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] whitespace-pre-line rounded-2xl px-3 py-2 text-small',
                  m.mine ? 'bg-green text-white' : 'bg-surface-2 text-ink',
                )}
              >
                {m.body}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        {sendError ? (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-md bg-risk/10 px-3 py-2 text-small text-risk">
            <p role="alert">{sendError}</p>
            <button type="button" className="shrink-0 font-semibold underline" onClick={() => void submit()}>
              {labels.retry}
            </button>
          </div>
        ) : null}
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
            onClick={() => void submit()}
            disabled={pending || input.trim() === ''}
            aria-label={labels.send}
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-green text-white transition-colors hover:bg-green-strong disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
