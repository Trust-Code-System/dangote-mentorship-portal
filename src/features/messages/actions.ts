'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Language } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { notifyMany } from '@/lib/notifications/notify';
import { ok, fail, mapActionError, type ActionResult } from '@/lib/actions/result';
import { getThread } from './data';

// Send a direct message (CLAUDE.md §10). Authorizes that the sender is a
// participant of the conversation; content stays private to participants.
// Message body is stored with the sender's language; translation is deferred.

const sendSchema = z.object({
  conversationId: z.string().cuid(),
  body: z.string().trim().min(1).max(4000),
});

export async function sendMessage(input: {
  conversationId: string;
  body: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { conversationId, body } = sendSchema.parse(input);

    // Authorization: only a participant may post. Load the conversation with its
    // participants so we can both authorize and notify the recipients afterwards.
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      select: {
        cohortId: true,
        participants: { where: { deletedAt: null }, select: { userId: true } },
      },
    });
    const isParticipant = conversation?.participants.some((p) => p.userId === user.id) ?? false;
    if (!conversation || !isParticipant) {
      return fail({ code: 'FORBIDDEN', message: 'You are not part of this conversation.' });
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        bodyOriginal: body,
        bodyLang: user.locale === 'FR' ? Language.FR : Language.EN,
      },
      select: { id: true },
    });

    // Touch the conversation so it sorts to the top of the list.
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Notify every other participant so the message reaches them even when they
    // aren't on the thread (the realtime nudge only reaches an open thread). The
    // notification carries no content — only that a message arrived (§10
    // confidentiality: admins are never participants, so they're never notified).
    const recipientIds = conversation.participants
      .map((p) => p.userId)
      .filter((id) => id !== user.id);
    await notifyMany(recipientIds, {
      type: 'message_received',
      params: { senderName: user.name ?? '' },
      link: `/messages/${conversationId}`,
      cohortId: conversation.cohortId,
    });

    revalidatePath('/messages');
    revalidatePath(`/messages/${conversationId}`);
    return ok({ id: message.id });
  } catch (error) {
    return mapActionError(error);
  }
}

const olderMessagesSchema = z.object({
  conversationId: z.string().cuid(),
  cursor: z.string().cuid(),
});

export async function loadOlderMessages(input: { conversationId: string; cursor: string }): Promise<
  ActionResult<{
    messages: Array<Omit<import('./data').ThreadMessage, 'createdAt'> & { createdAt: string }>;
    nextCursor: string | null;
  }>
> {
  try {
    const user = await requireUser();
    const { conversationId, cursor } = olderMessagesSchema.parse(input);
    const thread = await getThread(conversationId, user.id, cursor);
    if (!thread) {
      return fail({ code: 'FORBIDDEN', message: 'You are not part of this conversation.' });
    }
    return ok({
      messages: thread.messages.map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
      })),
      nextCursor: thread.nextCursor,
    });
  } catch (error) {
    return mapActionError(error);
  }
}
