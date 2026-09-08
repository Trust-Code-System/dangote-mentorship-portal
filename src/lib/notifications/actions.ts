'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireUser, hasAnyRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { mapActionError, ok, fail, type ActionResult } from '@/lib/actions/result';
import { countUnreadMessages } from '@/features/messages/data';
import { getUnreadCount, getUserNotifications } from './data';
import { NOTIFICATION_TYPES } from './types';

/** Shell dropdown payload — fetched on open so layouts skip the recent list query. */
export interface RecentNotificationItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
}

export async function fetchRecentNotifications(
  limit = 6,
): Promise<ActionResult<{ items: RecentNotificationItem[] }>> {
  try {
    const user = await requireUser();
    const rows = await getUserNotifications(user.id, limit);
    return ok({
      items: rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        link: n.link,
        read: n.readAt !== null,
      })),
    });
  } catch (error) {
    return mapActionError(error);
  }
}

/** Unread badges for the shell — loaded client-side so layouts stay off the badge DB path. */
export async function fetchShellBadges(): Promise<
  ActionResult<{ unreadNotifications: number; unreadMessages: number }>
> {
  try {
    const user = await requireUser();
    const isAdmin = hasAnyRole(user, ADMIN_ROLES);
    const [unreadNotifications, unreadMessages] = await Promise.all([
      getUnreadCount(user.id),
      isAdmin ? Promise.resolve(0) : countUnreadMessages(user.id),
    ]);
    return ok({ unreadNotifications, unreadMessages });
  } catch (error) {
    return mapActionError(error);
  }
}

// In-app notification controls (experience-layer.md §1.10). Marking read is
// transient state (not audited); preferences are a per-user setting.

const markSchema = z.object({ notificationId: z.string().cuid() });

export async function markNotificationRead(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { notificationId } = markSchema.parse({ notificationId: formData.get('notificationId') });

    const n = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!n || n.deletedAt || n.userId !== user.id) {
      return fail({ code: 'NOT_FOUND', message: 'Notification not found.' });
    }
    if (!n.readAt) {
      await prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
    }
    revalidatePath('/notifications');
    return ok({ id: notificationId });
  } catch (error) {
    return mapActionError(error);
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    const res = await prisma.notification.updateMany({
      where: { userId: user.id, deletedAt: null, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath('/notifications');
    return ok({ count: res.count });
  } catch (error) {
    return mapActionError(error);
  }
}

const prefsSchema = z.object({
  emailEnabled: z.coerce.boolean(),
  digestEnabled: z.coerce.boolean(),
  mutedTypes: z.array(z.enum(NOTIFICATION_TYPES)).default([]),
});

export async function saveNotificationPreferences(
  formData: FormData,
): Promise<ActionResult<{ ok: true }>> {
  try {
    const user = await requireUser();
    // Checkboxes: present when on. Muted types arrive as repeated `muted` fields.
    const data = prefsSchema.parse({
      emailEnabled: formData.get('emailEnabled') === 'on' || formData.get('emailEnabled') === 'true',
      digestEnabled: formData.get('digestEnabled') === 'on' || formData.get('digestEnabled') === 'true',
      mutedTypes: formData.getAll('muted').map(String),
    });

    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        emailEnabled: data.emailEnabled,
        digestEnabled: data.digestEnabled,
        mutedTypes: data.mutedTypes,
      },
      update: {
        emailEnabled: data.emailEnabled,
        digestEnabled: data.digestEnabled,
        mutedTypes: data.mutedTypes,
      },
    });
    revalidatePath('/notifications');
    return ok({ ok: true });
  } catch (error) {
    return mapActionError(error);
  }
}

// ── useActionState wrappers ─────────────────────────────────────────────────

export type NotificationActionState = ActionResult<unknown> | null;

export async function markAllNotificationsReadAction(formData: FormData): Promise<void> {
  void formData;
  await markAllNotificationsRead();
}
export async function markNotificationReadAction(formData: FormData): Promise<void> {
  await markNotificationRead(formData);
}
export async function saveNotificationPreferencesForm(
  _prev: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  return saveNotificationPreferences(formData);
}
