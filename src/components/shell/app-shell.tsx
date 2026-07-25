'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Target,
  NotebookPen,
  Video,
  CalendarDays,
  BookOpen,
  FileSignature,
  ClipboardCheck,
  Award,
  ScrollText,
  LifeBuoy,
  HelpCircle,
  Bell,
  MessageSquare,
  FolderKanban,
  Layers,
  Upload,
  Workflow,
  ClipboardList,
  GraduationCap,
  Mail,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { signOutAction } from '@/lib/auth/actions';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { BrandMark } from '@/components/brand-logo';
import { Wordmark } from '@/components/wordmark';
import { GlobalSearch } from '@/components/shell/global-search';
import {
  fetchRecentNotifications,
  fetchShellBadges,
} from '@/lib/notifications/actions';
import { cn } from '@/lib/utils';

// AppShell (§19 §3) — the authenticated chrome shared by the participant and
// admin areas: a collapsible left sidebar (icons + grouped nav), a slim top bar
// (search · language · notifications · profile), and a mobile bottom tab bar for
// the primary destinations. Server layouts pass role-filtered, translated nav so
// this stays presentation-only. All colour comes from the design tokens.

export type IconKey =
  | 'dashboard'
  | 'pair'
  | 'goals'
  | 'sessions'
  | 'meetings'
  | 'calendar'
  | 'journal'
  | 'agreements'
  | 'midterm'
  | 'final'
  | 'certificate'
  | 'support'
  | 'help'
  | 'notifications'
  | 'messages'
  | 'programmes'
  | 'cohorts'
  | 'imports'
  | 'matching'
  | 'forms'
  | 'mentors'
  | 'mentees'
  | 'invites'
  | 'training'
  | 'insights'
  | 'settings';

const ICONS: Record<IconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  pair: Users,
  goals: Target,
  sessions: NotebookPen,
  meetings: Video,
  calendar: CalendarDays,
  journal: BookOpen,
  agreements: FileSignature,
  midterm: ClipboardCheck,
  final: Award,
  certificate: ScrollText,
  support: LifeBuoy,
  help: HelpCircle,
  notifications: Bell,
  messages: MessageSquare,
  programmes: FolderKanban,
  cohorts: Layers,
  imports: Upload,
  matching: Workflow,
  forms: ClipboardList,
  mentors: Users,
  mentees: GraduationCap,
  invites: Mail,
  training: Award,
  insights: BarChart3,
  settings: Settings,
};

export interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
  /** Shown in the mobile bottom tab bar (cap at 4). */
  primary?: boolean;
  badge?: number;
  /** Index routes (e.g. /admin) match exactly so they don't light up on children. */
  exact?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export interface AppShellLabels {
  brand: string;
  subtitle: string;
  search: string;
  notifications: string;
  notificationsTitle: string;
  seeAll: string;
  noNotifications: string;
  signOut: string;
  openMenu: string;
  closeMenu: string;
  collapse: string;
  expand: string;
  more: string;
}

export interface NotifItem {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
}

export interface AppShellUser {
  name: string;
  roleLabel: string;
  initials: string;
  imageUrl?: string | null;
}

export interface AppShellProps {
  sections: NavSection[];
  user: AppShellUser;
  /** Initial unread notification count (layouts pass 0; client hydrates). */
  unread?: number;
  /** When true, fetch notification/message badges after mount (non-blocking). */
  loadBadges?: boolean;
  labels: AppShellLabels;
  children: React.ReactNode;
}

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (href === pathname) return true;
  if (exact) return false;
  // Avoid '/'-style false positives; match nested routes only on a segment edge.
  return href !== '/' && pathname.startsWith(href + '/');
}

function withBadges(
  sections: NavSection[],
  unreadNotifications: number,
  unreadMessages: number,
): NavSection[] {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.href === '/notifications') {
        return { ...item, badge: unreadNotifications || undefined };
      }
      if (item.href === '/messages' || item.href.startsWith('/messages/')) {
        return { ...item, badge: unreadMessages || undefined };
      }
      return item;
    }),
  }));
}

export function AppShell({
  sections,
  user,
  unread: unreadProp = 0,
  loadBadges = false,
  labels,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  // Optimistic sidebar highlight — set on click, cleared when the URL commits.
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const [recent, setRecent] = React.useState<NotifItem[]>([]);
  const [recentStatus, setRecentStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [unread, setUnread] = React.useState(unreadProp);
  const [unreadMessages, setUnreadMessages] = React.useState(0);

  // Close overlays and clear pending nav when the route commits.
  // Reset the dropdown cache so the next open reflects fresh unread bodies.
  React.useEffect(() => {
    setNotifOpen(false);
    setMobileOpen(false);
    setPendingHref(null);
    setRecent([]);
    setRecentStatus('idle');
  }, [pathname]);

  // Persist the desktop collapse preference so it doesn't reset on navigation.
  React.useEffect(() => {
    const saved = window.localStorage.getItem('shell:collapsed');
    if (saved) setCollapsed(saved === '1');
  }, []);
  React.useEffect(() => {
    window.localStorage.setItem('shell:collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  // Badge hydration — runs after paint and on focus; never blocks sidebar clicks.
  React.useEffect(() => {
    if (!loadBadges) return;
    let cancelled = false;

    function refreshBadges() {
      void fetchShellBadges().then((result) => {
        if (cancelled || !result.ok) return;
        setUnread(result.data.unreadNotifications);
        setUnreadMessages(result.data.unreadMessages);
      });
    }

    refreshBadges();
    function onFocus() {
      refreshBadges();
    }
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [loadBadges, pathname]);

  // Load recent notification bodies only when the dropdown opens (not on every nav).
  React.useEffect(() => {
    if (!notifOpen || recentStatus === 'loading' || recentStatus === 'ready') return;
    let cancelled = false;
    setRecentStatus('loading');
    void fetchRecentNotifications(6).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setRecent(result.data.items);
        setRecentStatus('ready');
      } else {
        setRecentStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [notifOpen, recentStatus]);

  const navSections = withBadges(sections, unread, unreadMessages);
  const allItems = navSections.flatMap((s) => s.items);
  const primary = allItems.filter((i) => i.primary).slice(0, 4);
  const navigating = pendingHref !== null;

  function onNavClick(href: string, event: React.MouseEvent<HTMLAnchorElement>) {
    // Same destination already pending — ignore repeat clicks without blocking others.
    if (pendingHref === href) {
      event.preventDefault();
      return;
    }
    // Already on this exact route — no pending chrome.
    if (href === pathname) return;
    setPendingHref(href);
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Thin top progress — visible only while a sidebar/tab nav is pending. */}
      <div
        aria-hidden={!navigating}
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-transparent',
          navigating ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div
          className={cn(
            'h-full w-1/3 bg-green',
            navigating && 'animate-pulse motion-reduce:animate-none',
          )}
        />
      </div>

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface transition-[width,transform] duration-200 ease-out motion-reduce:transition-none',
          collapsed ? 'lg:w-[4.5rem]' : 'lg:w-[180px]',
          'w-[260px]', // mobile drawer width
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className="flex h-[72px] items-center gap-2 px-4">
          <Link
            href="/"
            className={cn(
              'flex min-w-0 items-center gap-2.5 overflow-hidden',
              collapsed && 'lg:hidden', // narrow rail shows only the collapse chevron
            )}
          >
            <BrandMark className="size-7 shrink-0" />
            {!collapsed && (
              <span className="min-w-0 leading-tight">
                <Wordmark
                  name={labels.brand}
                  className="block max-w-[7.5rem] whitespace-normal font-display text-[0.72rem] font-bold leading-tight text-ink"
                />
                <span className="mt-0.5 block text-[0.58rem] text-ink-3">{labels.subtitle}</span>
              </span>
            )}
          </Link>

          {/* Desktop collapse toggle (Atlas-style chevron at the top of the rail) */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? labels.expand : labels.collapse}
            className={cn(
              'hidden rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface hover:text-ink lg:inline-flex',
              collapsed ? 'lg:mx-auto' : 'ml-auto',
            )}
          >
            {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
          </button>

          {/* Mobile drawer close */}
          <button
            type="button"
            aria-label={labels.closeMenu}
            className="ml-auto rounded-md p-1.5 text-ink-2 hover:bg-surface lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-2">
          {navSections.map((section, si) => (
            <div key={section.label ?? si} className="space-y-1">
              {section.label && !collapsed && <p className="sr-only">{section.label}</p>}
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(pathname, item.href, item.exact);
                const pending = pendingHref === item.href;
                const highlighted = active || pending;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    aria-busy={pending || undefined}
                    onClick={(e) => onNavClick(item.href, e)}
                    className={cn(
                      'group flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-[0.72rem] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-light/30 motion-reduce:transition-none',
                      collapsed && 'lg:justify-center lg:px-0',
                      highlighted
                        ? 'rounded-r-none border-r-2 border-green bg-green-soft/50 font-bold text-green-strong'
                        : 'font-medium text-ink-2 hover:bg-surface-2 hover:text-ink',
                      pending && !active && 'opacity-90',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        highlighted ? 'text-green-strong' : 'text-ink-3 group-hover:text-green-light',
                      )}
                    />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.badge ? (
                      <span
                        className={cn(
                          'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-micro text-white',
                          highlighted ? 'bg-green-strong' : 'bg-green',
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Profile card + sign out (Stitch bottom-of-rail profile) */}
        <div className="p-3">
          <div
            className={cn(
              'flex items-center gap-2 rounded-md p-1.5',
              collapsed && 'lg:justify-center lg:bg-transparent lg:p-0',
            )}
          >
            <Link
              href="/profile"
              className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-green-soft text-micro font-bold text-green-strong"
              title={user.name}
            >
              {user.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.imageUrl} alt="" className="size-full object-cover" />
              ) : (
                user.initials
              )}
            </Link>
            {!collapsed && (
              <Link href="/profile" className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-small font-bold text-ink">{user.name}</span>
                <span className="block truncate text-micro uppercase tracking-wider text-ink-3">
                  {user.roleLabel}
                </span>
              </Link>
            )}
            <form action={signOutAction} className={cn(collapsed && 'lg:hidden')}>
              <button
                type="submit"
                aria-label={labels.signOut}
                title={labels.signOut}
                className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface hover:text-risk"
              >
                <LogOut className="size-5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200 ease-out motion-reduce:transition-none',
          collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-[180px]',
        )}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-border bg-surface px-4 sm:px-5">
          <button
            type="button"
            aria-label={labels.openMenu}
            className="rounded-md p-2 text-ink-2 hover:bg-surface-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </button>

          {/* Global search — pages (client-side) + RBAC-scoped records (admins). */}
          <GlobalSearch navItems={allItems.map((i) => ({ label: i.label, href: i.href }))} />

          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher />
            <div className="relative">
              <button
                type="button"
                aria-label={labels.notifications}
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((o) => !o)}
                className="relative rounded-md p-2 text-ink-2 hover:bg-surface-2"
              >
                <Bell className="size-5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-risk px-1 text-[0.625rem] font-semibold leading-none text-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  {/* Click-away backdrop */}
                  <div
                    aria-hidden
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface">
                    <div className="border-b border-border px-4 py-3">
                      <p className="text-small font-semibold text-ink">
                        {labels.notificationsTitle}
                      </p>
                    </div>
                    {recentStatus === 'loading' || recentStatus === 'idle' ? (
                      <div className="space-y-3 px-4 py-4" aria-busy="true">
                        <div className="h-10 animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
                        <div className="h-10 animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
                        <div className="h-10 animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
                      </div>
                    ) : recentStatus === 'error' ? (
                      <p className="px-4 py-6 text-center text-small text-ink-3">
                        {labels.noNotifications}
                      </p>
                    ) : recent.length === 0 ? (
                      <p className="px-4 py-6 text-center text-small text-ink-3">
                        {labels.noNotifications}
                      </p>
                    ) : (
                      <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                        {recent.map((n) => {
                          const inner = (
                            <div className="flex items-start gap-2">
                              {!n.read && (
                                <span
                                  aria-hidden
                                  className="mt-1.5 size-2 shrink-0 rounded-full bg-green"
                                />
                              )}
                              <div className={cn('min-w-0', n.read && 'pl-4')}>
                                <p className="truncate text-small font-medium text-ink">
                                  {n.title}
                                </p>
                                {n.body && (
                                  <p className="line-clamp-2 text-micro text-ink-2">{n.body}</p>
                                )}
                              </div>
                            </div>
                          );
                          return (
                            <li
                              key={n.id}
                              className={cn('px-4 py-3', !n.read && 'bg-green-soft/40')}
                            >
                              {n.link ? (
                                <Link
                                  href={n.link}
                                  onClick={() => setNotifOpen(false)}
                                  className="block hover:opacity-80"
                                >
                                  {inner}
                                </Link>
                              ) : (
                                inner
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <Link
                      href="/notifications"
                      onClick={(e) => {
                        setNotifOpen(false);
                        onNavClick('/notifications', e);
                      }}
                      className="block border-t border-border px-4 py-3 text-center text-small font-medium text-green-strong hover:bg-surface-2"
                    >
                      {labels.seeAll}
                    </Link>
                  </div>
                </>
              )}
            </div>
            <Link
              href="/profile"
              aria-label={user.name}
              className="ml-1 flex size-9 items-center justify-center overflow-hidden rounded-full border border-border bg-green-soft text-small font-bold text-green-strong transition-colors hover:border-green-light"
            >
              {user.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.imageUrl} alt="" className="size-full object-cover" />
              ) : (
                user.initials
              )}
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-5 pb-24 sm:px-5 lg:pb-8">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-bg lg:hidden">
        {primary.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href, item.exact);
          const pending = pendingHref === item.href;
          const highlighted = active || pending;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              aria-busy={pending || undefined}
              onClick={(e) => onNavClick(item.href, e)}
              className={cn(
                'flex min-h-11 flex-1 flex-col items-center gap-0.5 py-2 text-micro transition-colors duration-150',
                highlighted ? 'text-green-strong' : 'text-ink-3',
              )}
            >
              <Icon className="size-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-micro text-ink-3"
        >
          <Menu className="size-5" />
          <span>{labels.more}</span>
        </button>
      </nav>
    </div>
  );
}
