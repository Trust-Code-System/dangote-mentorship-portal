import 'server-only';
import { createHmac } from 'node:crypto';
import { cache } from 'react';
import { ConversationType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getMentorPairings, getMenteePairing } from '@/lib/pairings';

// Direct messaging reads (CLAUDE.md §10). DMs are default-provisioned for each
// matched mentor↔mentee pair. Confidentiality (§10): only the two participants
// can read a conversation — admins are never participants, so they cannot read
// content here (they see metadata elsewhere). Realtime, attachments, and the
// per-message translate toggle are deferred to a later slice.

export interface ConversationSummary {
  id: string;
  otherName: string | null;
  lastMessage: string | null;
  lastAt: Date | null;
  unread: number;
}

export interface ThreadMessage {
  id: string;
  mine: boolean;
  senderName: string | null;
  body: string;
  createdAt: Date;
}

export interface Thread {
  id: string;
  otherName: string | null;
  messages: ThreadMessage[];
  nextCursor: string | null;
}

const MESSAGE_PAGE_SIZE = 50;

async function findDirectConversation(
  userId: string,
  otherId: string,
  cohortId: string,
): Promise<{ id: string } | null> {
  const directKey = directConversationKey(cohortId, userId, otherId);
  // "exactly these two" = every participant is in {me, other} AND both present.
  return prisma.conversation.findFirst({
    where: {
      type: ConversationType.DIRECT,
      cohortId,
      deletedAt: null,
      OR: [
        { directKey },
        {
          directKey: null,
          participants: { every: { userId: { in: [userId, otherId] } } },
          AND: [
            { participants: { some: { userId } } },
            { participants: { some: { userId: otherId } } },
          ],
        },
      ],
    },
    select: { id: true },
  });
}

export function directConversationKey(cohortId: string, firstUserId: string, secondUserId: string): string {
  return `${cohortId}:${[firstUserId, secondUserId].sort().join(':')}`;
}

export function realtimeChannelName(conversationId: string): string | null {
  const secret = process.env.REALTIME_CHANNEL_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) return null;
  const opaqueId = createHmac('sha256', secret).update(conversationId).digest('base64url');
  return `conversation:${opaqueId}`;
}

/** Provision a DIRECT conversation for each of the user's accepted pairings. */
export async function ensureDirectConversations(userId: string): Promise<void> {
  const pairs: { cohortId: string; otherId: string }[] = [];
  for (const p of await getMentorPairings(userId)) {
    pairs.push({ cohortId: p.cohortId, otherId: p.menteeId });
  }
  const asMentee = await getMenteePairing(userId);
  if (asMentee) pairs.push({ cohortId: asMentee.cohortId, otherId: asMentee.mentorId });

  await Promise.all(
    pairs.map(async ({ cohortId, otherId }) => {
      const directKey = directConversationKey(cohortId, userId, otherId);
      const existing = await findDirectConversation(userId, otherId, cohortId);
      if (existing) {
        await prisma.conversation.updateMany({
          where: { id: existing.id, directKey: null },
          data: { directKey },
        });
        return;
      }
      await prisma.conversation.upsert({
        where: { directKey },
        update: {},
        create: {
          directKey,
          cohortId,
          type: ConversationType.DIRECT,
          participants: { create: [{ userId }, { userId: otherId }] },
        },
      });
    }),
  );
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const parts = await prisma.conversationParticipant.findMany({
    where: { userId, deletedAt: null, conversation: { deletedAt: null } },
    include: {
      conversation: {
        include: {
          participants: {
            where: { userId: { not: userId } },
            include: { user: { select: { name: true } } },
          },
          messages: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
          _count: {
            select: {
              messages: {
                where: {
                  deletedAt: null,
                  senderId: { not: userId },
                  reads: { none: { userId } },
                },
              },
            },
          },
        },
      },
    },
  });

  const summaries = parts.map((p) => {
    const c = p.conversation;
    const last = c.messages[0] ?? null;
    return {
      id: c.id,
      otherName: c.participants[0]?.user.name ?? null,
      lastMessage: last?.bodyOriginal ?? null,
      lastAt: last?.createdAt ?? c.updatedAt,
      unread: c._count.messages,
    };
  });

  summaries.sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0));
  return summaries;
}

/** Total unread messages across all of the user's conversations (nav badge). */
/** Request-scoped memo — shell badge + messages page share one count per pass. */
export const countUnreadMessages = cache(async (userId: string): Promise<number> => {
  return prisma.message.count({
    where: {
      deletedAt: null,
      senderId: { not: userId },
      reads: { none: { userId } },
      conversation: {
        deletedAt: null,
        participants: { some: { userId, deletedAt: null } },
      },
    },
  });
});

/** A conversation the user participates in, or null (also covers authz). */
export async function getThread(
  conversationId: string,
  userId: string,
  cursor?: string,
): Promise<Thread | null> {
  const convo = await prisma.conversation.findFirst({
    where: { id: conversationId, deletedAt: null, participants: { some: { userId } } },
    include: {
      participants: {
        where: { userId: { not: userId } },
        include: { user: { select: { name: true } } },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MESSAGE_PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { sender: { select: { name: true } } },
      },
    },
  });
  if (!convo) return null;
  const hasMore = convo.messages.length > MESSAGE_PAGE_SIZE;
  const page = convo.messages.slice(0, MESSAGE_PAGE_SIZE);
  return {
    id: convo.id,
    otherName: convo.participants[0]?.user.name ?? null,
    messages: page
      .map((m) => ({
        id: m.id,
        mine: m.senderId === userId,
        senderName: m.sender.name,
        body: m.bodyOriginal,
        createdAt: m.createdAt,
      }))
      .reverse(),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

/** Mark every message the user hasn't read in a conversation as read. */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const unread = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      senderId: { not: userId },
      reads: { none: { userId } },
    },
    select: { id: true },
  });
  if (unread.length === 0) return;
  await prisma.messageRead.createMany({
    data: unread.map((m) => ({ messageId: m.id, userId })),
    skipDuplicates: true,
  });
}
