import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { FileText, Target, Users, Video } from 'lucide-react';
import { requireUser } from '@/lib/auth/rbac';
import {
  ensureDirectConversations,
  listConversations,
  getThread,
  markConversationRead,
} from '@/features/messages/data';
import { ConversationList } from '@/features/messages/conversation-list';
import { MessageThread } from '@/features/messages/message-thread';

function initialsOf(name: string | null): string {
  const s = (name ?? '?').trim();
  const [a, b] = s.split(/\s+/).filter(Boolean);
  if (a && b) return (a.charAt(0) + b.charAt(0)).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

// A single conversation thread. getThread also authorizes participation (returns
// null for non-participants → 404), so admins/non-members cannot read content.
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const user = await requireUser();
  const t = await getTranslations('messages');

  await ensureDirectConversations(user.id);
  const thread = await getThread(conversationId, user.id);
  if (!thread) notFound();

  // Mark read before listing so the open conversation shows 0 unread.
  await markConversationRead(conversationId, user.id);
  const conversations = await listConversations(user.id);

  return (
    <section className="grid min-h-[calc(100vh-6.5rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-elevation lg:grid-cols-[17rem_1fr] xl:grid-cols-[17rem_1fr_15rem]">
      <div className="hidden lg:block">
        <ConversationList
          items={conversations}
          activeId={conversationId}
          labels={{ title: 'Discussions', empty: t('empty'), emptyHint: t('emptyHint') }}
        />
      </div>
      <MessageThread
        key={`${conversationId}:${thread.messages.at(-1)?.id ?? 'empty'}:${thread.nextCursor ?? 'end'}`}
        conversationId={conversationId}
        otherName={thread.otherName}
        initialMessages={thread.messages}
        initialNextCursor={thread.nextCursor}
        labels={{
          placeholder: t('placeholder'),
          send: t('send'),
          empty: t('threadEmpty'),
          back: t('back'),
          loadOlder: t('loadOlder'),
        }}
      />

      {/* Context panel (Stitch messages 3rd column) — real data only: the other
          participant + a link into the shared pair workspace where their full
          profile, goals and agreements live. Attachments ("shared assets") are
          deferred, so that section is intentionally omitted. */}
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
            Mentorship focus
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-green-soft px-2 py-1 text-micro text-green-strong">
              Strategy
            </span>
            <span className="rounded-full bg-green-soft px-2 py-1 text-micro text-green-strong">
              Leadership
            </span>
          </div>
        </div>
        <div className="mt-6 border-t border-border pt-5 text-left">
          <p className="text-micro font-bold uppercase tracking-wider text-ink-3">Shared assets</p>
          <div className="mt-3 space-y-2">
            <Link
              href="/agreements"
              className="flex items-center gap-2 rounded-md bg-surface-2 p-2 text-micro text-ink-2"
            >
              <FileText className="size-4 text-info" /> Agreement.pdf
            </Link>
            <Link
              href="/sessions"
              className="flex items-center gap-2 rounded-md bg-surface-2 p-2 text-micro text-ink-2"
            >
              <Video className="size-4 text-green-light" /> Session notes
            </Link>
          </div>
        </div>
      </aside>
    </section>
  );
}
