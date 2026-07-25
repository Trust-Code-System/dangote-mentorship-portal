import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, hasAnyRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { AppShell, type AppShellLabels } from '@/components/shell/app-shell';
import { buildAdminNavSections } from '@/lib/nav/sections';

function initialsOf(name?: string | null, email?: string): string {
  const source = (name ?? email ?? '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const [a, b] = parts;
  if (a && b) return (a.charAt(0) + b.charAt(0)).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function roleLabelOf(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate (CLAUDE.md §3, §4). Badge counts hydrate client-side.
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAnyRole(user, ADMIN_ROLES)) redirect('/dashboard');

  const [tNav, tShell, tCommon] = await Promise.all([
    getTranslations('nav'),
    getTranslations('shell'),
    getTranslations('common'),
  ]);

  const sections = await buildAdminNavSections(0, user.roles);

  const labels: AppShellLabels = {
    brand: tCommon('appShortName'),
    subtitle: tShell('enterprisePortal'),
    search: tShell('search'),
    notifications: tNav('notifications'),
    notificationsTitle: tNav('notifications'),
    seeAll: tShell('seeAllNotifications'),
    noNotifications: tShell('noNotifications'),
    signOut: tCommon('signOut'),
    openMenu: tShell('openMenu'),
    closeMenu: tShell('closeMenu'),
    collapse: tShell('collapse'),
    expand: tShell('expand'),
    more: tShell('more'),
  };

  return (
    <AppShell
      sections={sections}
      unread={0}
      loadBadges
      user={{
        name: user.name ?? user.email,
        roleLabel: user.roles.map(roleLabelOf).join(' · '),
        initials: initialsOf(user.name, user.email),
        imageUrl: user.image ? `/api/avatar/${user.id}` : null,
      }}
      labels={labels}
    >
      {children}
    </AppShell>
  );
}
