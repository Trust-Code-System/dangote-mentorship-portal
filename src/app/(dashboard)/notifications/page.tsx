import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/rbac';
import { getUserNotifications, getUnreadCount, getPreferences } from '@/lib/notifications/data';
import { NOTIFICATION_TYPES } from '@/lib/notifications/types';
import { NotificationList } from './notification-list';
import { PreferencesForm } from './preferences-form';

// In-app notification centre (experience-layer.md §1.10). Lists the user's
// notifications (deep-linked), lets them mark read, and edit channel/per-type
// preferences. Language follows the user's locale, as everywhere.
export default async function NotificationsPage() {
  const user = await requireUser();
  const t = await getTranslations('notifications');

  const [items, unread, prefs] = await Promise.all([
    getUserNotifications(user.id),
    getUnreadCount(user.id),
    getPreferences(user.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-h1 font-semibold tracking-tight text-ink">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <NotificationList
        items={items.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          read: n.readAt !== null,
          createdAt: n.createdAt.toISOString(),
        }))}
        unread={unread}
      />

      <PreferencesForm
        types={[...NOTIFICATION_TYPES]}
        emailEnabled={prefs.emailEnabled}
        digestEnabled={prefs.digestEnabled}
        mutedTypes={prefs.mutedTypes}
      />
    </div>
  );
}
