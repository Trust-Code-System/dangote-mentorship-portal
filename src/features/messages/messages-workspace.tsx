import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FileText, Target, Users, Video } from 'lucide-react';
import {
  ensureDirectConversations,
  listConversations,
  getThread,
  markConversationRead,
  realtimeChannelName,
} from '@/features/messages/data';
import { ConversationList } from '@/features/messages/conversation-list';
import { MessageThread } from '@/features/messages/message-thread';

function initialsOf(name: string | null): string {
  const s = (name ?? '?').trim();
  const [a, b] = s.split(/\s+/).filter(Boolean);
  if (a && b) return (a.charAt(0) + b.charAt(0)).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

/**
 * Shared messages UI for `/messages` and `/messages/[conversationId]`.
 * Renders in-place so the index route never issues a server `redirect()` during
 * client-side sidebar navigation (prefetch + redirect races were crashing the
 * soft navigation into Next's default global error screen).
 */
export async function MessagesWorkspace({
  userId,
  conversationId,
}: {
  userId: string;
  /** When null, open the first conversation if any; otherwise show the empty pane. */
  conversationId: string | null;
}) {
  const t = await getTranslations('messages');

  await ensureDirectConversations(userId);
  let conversations = await listConversations(userId);

  const activeId =
    conversationId ??
    (conversations.length > 0 ? (conversations[0]?.id ?? null) : null);

  if (!activeId) {
    return (
      <section className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <ConversationList
          items={conversations}
          activeId={null}
          labels={{
            title: t('title'),
            empty: t('empty'),
            emptyHint: t('emptyHint'),
          }}
        />
        <div className="hidden items-center justify-center rounded-2xl border border-border bg-surface text-body text-ink-3 lg:flex">
          {t('selectConversation')}
        </div>
      </section>
    );
  }

  const thread = await getThread(activeId, userId);
  if (!thread) {
    // Stale / unauthorized id — show the list without crashing the shell.
    return (
      <section className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <ConversationList
          items={conversations}
          activeId={null}
          labels={{
            title: t('title'),
            empty: t('empty'),
            emptyHint: t('emptyHint'),
          }}
        />
        <div className="flex items-center justify-center rounded-2xl border border-border bg-surface p-8 text-center text-body text-ink-3">
          {t('selectConversation')}
        </div>
      </section>
    );
  }

  await markConversationRead(activeId, userId);
  conversations = await listConversations(userId);

  return (
    <section className="grid min-h-[calc(100vh-6.5rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-elevation lg:grid-cols-[17rem_1fr] xl:grid-cols-[17rem_1fr_15rem]">
      <div className="hidden lg:block">
        <ConversationList
          items={conversations}
          activeId={activeId}
          labels={{
            title: t('conversationListTitle'),
            empty: t('empty'),
            emptyHint: t('emptyHint'),
          }}
        />
      </div>
      <MessageThread
        key={`${activeId}:${thread.messages.at(-1)?.id ?? 'empty'}:${thread.nextCursor ?? 'end'}`}
        conversationId={activeId}
        otherName={thread.otherName}
        initialMessages={thread.messages}
        initialNextCursor={thread.nextCursor}
        labels={{
          placeholder: t('placeholder'),
          send: t('send'),
          empty: t('threadEmpty'),
          back: t('back'),
          loadOlder: t('loadOlder'),
          sendFailed: t('sendFailed'),
          retry: t('retry'),
        }}
        realtimeChannel={realtimeChannelName(activeId)}
      />

      <aside className="hidden h-full border-l border-border bg-surface p-5 text-center xl:block">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-soft text-h2 font-bold text-green-strong">
          {initialsOf(thread.otherName)}
        </span>
        <p className="mt-3 font-bold text-ink">{thread.otherName ?? '—'}</p>
        <p className="text-small text-ink-2">{t('participantSubtitle')}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            href="/pair"
            className="flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-2 text-micro font-medium text-ink transition-colors hover:bg-surface-2"
          >
            <Users className="size-3.5 text-green-light" />
            {t('viewPair')}
          </Link>
          <Link
            href="/goals"
            className="flex items-center justify-center gap-1.5 rounded-md bg-green px-2 py-2 text-micro font-medium text-white transition-colors hover:bg-green-strong"
          >
            <Target className="size-3.5" />
            {t('viewGoals')}
          </Link>
        </div>
        <div className="mt-6 border-t border-border pt-5 text-left">
          <p className="text-micro font-bold uppercase tracking-wider text-ink-3">
            {t('mentorshipFocus')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-green-soft px-2 py-1 text-micro text-green-strong">
              {t('strategy')}
            </span>
            <span className="rounded-full bg-green-soft px-2 py-1 text-micro text-green-strong">
              {t('leadership')}
            </span>
          </div>
        </div>
        <div className="mt-6 border-t border-border pt-5 text-left">
          <p className="text-micro font-bold uppercase tracking-wider text-ink-3">
            {t('sharedAssets')}
          </p>
          <div className="mt-3 space-y-2">
            <Link
              href="/agreements"
              className="flex items-center gap-2 rounded-md bg-surface-2 p-2 text-micro text-ink-2"
            >
              <FileText className="size-4 text-info" /> {t('agreementDocument')}
            </Link>
            <Link
              href="/sessions"
              className="flex items-center gap-2 rounded-md bg-surface-2 p-2 text-micro text-ink-2"
            >
              <Video className="size-4 text-green-light" /> {t('sessionNotes')}
            </Link>
          </div>
        </div>
      </aside>
    </section>
  );
}
