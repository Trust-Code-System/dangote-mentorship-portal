import 'server-only';
import { getTranslations } from 'next-intl/server';
import { RoleName } from '@prisma/client';
import type { NavItem, NavSection } from '@/components/shell/app-shell';
import { defaultDashboardPath } from '@/lib/auth/roles';

// Shared sidebar nav builders so the admin area and the participant area (which
// hosts the cross-cutting Notifications / Support / Help / Profile pages) render
// the SAME nav for a given user. Without this, an admin who clicks the bell lands
// in the participant shell and loses their admin nav (every item filtered out).

export async function buildAdminNavSections(
  unread: number,
  roles: RoleName[] = [],
): Promise<NavSection[]> {
  const [t, tImports, tMatching, tPeople, tInvites, tSupport, tForms, tLists, tInsights, tSettings, tNav, tShell] =
    await Promise.all([
      getTranslations('admin'),
      getTranslations('imports'),
      getTranslations('matching'),
      getTranslations('people'),
      getTranslations('invites'),
      getTranslations('support'),
      getTranslations('forms'),
      getTranslations('adminLists'),
      getTranslations('insights'),
      getTranslations('settings'),
      getTranslations('nav'),
      getTranslations('shell'),
    ]);

  // Platform settings are Super-Admin only (CLAUDE.md §4); hide the link from
  // Programme Admins, who would only be bounced off the page.
  const isSuperAdmin = roles.includes(RoleName.SUPER_ADMIN);

  return [
    {
      label: tShell('navManage'),
      items: [
        { href: '/admin', label: tNav('dashboard'), icon: 'dashboard', primary: true, exact: true },
        { href: '/admin/matching', label: tMatching('title'), icon: 'matching', primary: true },
        { href: '/admin/insights', label: tInsights('navLabel'), icon: 'insights' },
        { href: '/admin/programmes', label: t('programmes'), icon: 'programmes' },
        { href: '/admin/cohorts', label: t('cohorts'), icon: 'cohorts' },
        { href: '/admin/imports', label: tImports('title'), icon: 'imports' },
        { href: '/admin/forms', label: tForms('title'), icon: 'forms' },
        { href: '/admin/goals', label: tLists('navGoals'), icon: 'goals' },
        { href: '/admin/sessions', label: tLists('navSessions'), icon: 'sessions' },
        { href: '/admin/meetings', label: tLists('navMeetings'), icon: 'meetings' },
        { href: '/admin/training', label: tLists('navTraining'), icon: 'training' },
      ],
    },
    {
      label: tShell('navPeople'),
      items: [
        { href: '/admin/mentors', label: tPeople('mentorsTitle'), icon: 'mentors', primary: true },
        { href: '/admin/mentees', label: tPeople('menteesTitle'), icon: 'mentees', primary: true },
        { href: '/admin/invites', label: tInvites('title'), icon: 'invites' },
      ],
    },
    ...(isSuperAdmin
      ? [
          {
            label: tShell('navPlatform'),
            items: [{ href: '/admin/settings', label: tSettings('title'), icon: 'settings' as const }],
          },
        ]
      : []),
    {
      label: tShell('navHelp'),
      items: [
        { href: '/notifications', label: tNav('notifications'), icon: 'notifications', badge: unread || undefined },
        { href: '/admin/support', label: tSupport('queueTitle'), icon: 'support' },
      ],
    },
  ];
}

export async function buildParticipantNavSections(
  roles: RoleName[],
  unread: number,
  unreadMessages = 0,
): Promise<NavSection[]> {
  const [tNav, tShell] = await Promise.all([getTranslations('nav'), getTranslations('shell')]);
  const isPair = roles.includes(RoleName.MENTOR) || roles.includes(RoleName.MENTEE);

  const pairItems: NavItem[] = isPair
    ? [
        { href: '/pair', label: tNav('pair'), icon: 'pair', primary: true },
        { href: '/goals', label: tNav('goals'), icon: 'goals', primary: true },
        { href: '/sessions', label: tNav('sessions'), icon: 'sessions', primary: true },
        { href: '/messages', label: tNav('messages'), icon: 'messages', badge: unreadMessages || undefined },
        { href: '/meetings', label: tNav('meetings'), icon: 'meetings' },
        { href: '/calendar', label: tNav('calendar'), icon: 'calendar' },
        { href: '/journal', label: tNav('journal'), icon: 'journal' },
        { href: '/agreements', label: tNav('agreements'), icon: 'agreements' },
      ]
    : [];

  return [
    {
      label: tShell('navMain'),
      items: [
        { href: defaultDashboardPath(roles), label: tNav('dashboard'), icon: 'dashboard', primary: true, exact: true },
        ...pairItems,
      ],
    },
    ...(isPair
      ? [
          {
            label: tShell('navReviews'),
            items: [
              { href: '/mid-term-review', label: tNav('midTermReview'), icon: 'midterm' as const },
              { href: '/final-review', label: tNav('finalReview'), icon: 'final' as const },
              { href: '/certificate', label: tNav('certificate'), icon: 'certificate' as const },
            ],
          },
        ]
      : []),
    {
      label: tShell('navHelp'),
      items: [
        { href: '/notifications', label: tNav('notifications'), icon: 'notifications', badge: unread || undefined },
        { href: '/support', label: tNav('support'), icon: 'support' },
        { href: '/help', label: tNav('help'), icon: 'help' },
      ],
    },
  ];
}
