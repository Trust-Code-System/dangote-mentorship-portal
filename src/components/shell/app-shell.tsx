'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  CalendarClock,
  CalendarCheck,
  Activity,
  FileText,
  Newspaper,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { signOutAction } from '@/lib/auth/actions';
import { LocaleSwitcher } from '@/components/locale-switcher';
import type { AppLocale } from '@/i18n/config';
import { BrandPlate } from '@/components/brand-logo';
import { Wordmark } from '@/components/wordmark';
import { GlobalSearch } from '@/components/shell/global-search';
import { NavSpinner } from '@/components/shell/nav-spinner';
import { isNavItemCommitted, resolveNavItemVisualState } from '@/components/shell/nav-item-state';
import { fetchRecentNotifications, fetchShellBadges } from '@/lib/notifications/actions';
import { cn } from '@/lib/utils';
import { SoftPanel } from '@/components/motion/soft-panel';
import { AnimatedContent } from '@/components/motion/animated-content';

/** Clear stuck pending chrome if the URL never commits (cancelled / failed nav). */
const PENDING_NAV_TIMEOUT_MS = 12_000;

function ShellAvatar({
  imageUrl,
  initials,
}: {
  imageUrl: string | null | undefined;
  initials: string;
}) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);

  if (!imageUrl || failedUrl === imageUrl) return <>{initials}</>;

  return (
    // The private avatar route can return 404 when a stored object was removed.
    // Keep navigation usable and visually complete in that recoverable state.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      className="size-full object-cover"
      onError={() => setFailedUrl(imageUrl)}
    />
  );
}
/** Avoid flicker for very fast background refreshes. */
const REFRESH_INDICATOR_MIN_MS = 150;
/** Survives AppShell remount when crossing (admin) ↔ (dashboard) layouts. */
const SIDEBAR_SCROLL_KEY = 'shell:sidebar-scroll';

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
  | 'settings'
  | 'assessment'
  | 'monthly'
  | 'reports'
  | 'newsletters'
  | 'engagement';

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
  assessment: CalendarClock,
  monthly: CalendarCheck,
  reports: FileText,
  newsletters: Newspaper,
  engagement: Activity,
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
  /** Optional line under the brand name. Omitted in the app shells: the
   *  programme name already says what this is. */
  subtitle?: string;
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
  /** Quiet header cue while cached RSC is revalidated in the background. */
  updating: string;
  /** Screen-reader label for the sidebar pending spinner. */
  navigating: string;
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
  /** Interface languages available to this viewer's cohort. */
  availableLocales?: readonly AppLocale[];
  labels: AppShellLabels;
  children: React.ReactNode;
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
  availableLocales,
  labels,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  // Pending destination only — never shares the full active chrome with the committed route.
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [recent, setRecent] = React.useState<NotifItem[]>([]);
  const [recentStatus, setRecentStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [unread, setUnread] = React.useState(unreadProp);
  const [unreadMessages, setUnreadMessages] = React.useState(0);

  const prefetchedRef = React.useRef(new Set<string>());
  const visitedRef = React.useRef(new Set<string>());
  const pendingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshGenRef = React.useRef(0);
  const sidebarNavRef = React.useRef<HTMLElement>(null);
  const sidebarRef = React.useRef<HTMLElement>(null);

  React.useLayoutEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const updateInert = () => {
      if (sidebarRef.current) sidebarRef.current.inert = !desktop.matches && !mobileOpen;
    };
    updateInert();
    desktop.addEventListener('change', updateInert);
    return () => desktop.removeEventListener('change', updateInert);
  }, [mobileOpen]);

  // The mobile rail is a modal drawer: keep keyboard focus inside it and return
  // focus to its opener when it closes. The desktop rail stays ordinary nav.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebar.querySelector<HTMLElement>('[data-drawer-close]')?.focus();
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(
        sidebar.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'),
      ).filter(
        (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onDesktop);
      if (opener?.isConnected) opener.focus();
    };
  }, [mobileOpen]);

  // Restore sidebar scroll after layout remounts (e.g. /admin → /notifications).
  // sessionStorage so it survives the unmount; useLayoutEffect avoids a top→saved flash.
  React.useLayoutEffect(() => {
    const nav = sidebarNavRef.current;
    if (!nav) return;
    try {
      const saved = window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
      if (saved != null) {
        const top = Number(saved);
        if (Number.isFinite(top) && top > 0) nav.scrollTop = top;
      }
    } catch {
      // sessionStorage can throw in private mode; ignore.
    }
  }, []);

  function clearPendingTimer() {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }

  function armPendingTimeout() {
    clearPendingTimer();
    pendingTimerRef.current = setTimeout(() => {
      setPendingHref(null);
      pendingTimerRef.current = null;
    }, PENDING_NAV_TIMEOUT_MS);
  }

  // Close overlays and clear pending when the URL commits. Repeat visits reuse
  // the Next.js client router cache (staleTimes) for instant content; we do NOT
  // call router.refresh() on every navigation — in Next 16 that eagerly
  // re-prefetches in-viewport Links and defeats neighbouring cache hits.
  React.useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setNotifOpen(false);
      setMobileOpen(false);
      setPendingHref(null);
      clearPendingTimer();
      setRecent([]);
      setRecentStatus('idle');
    });
    visitedRef.current.add(pathname);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Quiet background revalidation when the tab regains focus on a previously
  // visited route. Mutations already revalidatePath + router.refresh() locally.
  React.useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    function softRefreshCurrentRoute() {
      if (!visitedRef.current.has(pathname)) return;
      const gen = ++refreshGenRef.current;
      let shownAt = 0;

      const showTimer = setTimeout(() => {
        if (refreshGenRef.current !== gen) return;
        shownAt = Date.now();
        setIsRefreshing(true);
      }, REFRESH_INDICATOR_MIN_MS);
      timers.push(showTimer);

      void Promise.resolve(router.refresh()).finally(() => {
        if (refreshGenRef.current !== gen) return;
        clearTimeout(showTimer);
        if (!shownAt) {
          setIsRefreshing(false);
          return;
        }
        const remain = Math.max(0, REFRESH_INDICATOR_MIN_MS - (Date.now() - shownAt));
        timers.push(
          setTimeout(() => {
            if (refreshGenRef.current === gen) setIsRefreshing(false);
          }, remain),
        );
      });
    }

    function onFocus() {
      softRefreshCurrentRoute();
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') softRefreshCurrentRoute();
    }

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      refreshGenRef.current += 1;
      for (const id of timers) clearTimeout(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      setIsRefreshing(false);
    };
  }, [pathname, router]);

  // Persist the desktop collapse preference so it doesn't reset on navigation.
  React.useEffect(() => {
    const saved = window.localStorage.getItem('shell:collapsed');
    if (saved) queueMicrotask(() => setCollapsed(saved === '1'));
  }, []);
  React.useEffect(() => {
    window.localStorage.setItem('shell:collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  React.useEffect(() => () => clearPendingTimer(), []);

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
  // Depend only on notifOpen — including recentStatus caused a stuck skeleton:
  // set('loading') re-ran the effect, cancelled the in-flight fetch, then bailed
  // on the loading guard so the result was never applied.
  React.useEffect(() => {
    if (!notifOpen) return;

    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return;
        setRecentStatus((prev) => (prev === 'ready' ? prev : 'loading'));
        return fetchRecentNotifications(6);
      })
      .then((result) => {
        if (!result) return;
        if (cancelled) return;
        if (result.ok) {
          setRecent(result.data.items);
          setRecentStatus('ready');
        } else {
          setRecentStatus((prev) => (prev === 'ready' ? prev : 'error'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [notifOpen]);

  const navSections = withBadges(sections, unread, unreadMessages);
  const allItems = navSections.flatMap((s) => s.items);
  const primary = allItems.filter((i) => i.primary).slice(0, 4);
  const navigating = pendingHref !== null;

  function prefetchHref(href: string) {
    if (prefetchedRef.current.has(href) || href === pathname) return;
    prefetchedRef.current.add(href);
    try {
      router.prefetch(href);
    } catch {
      // Prefetch is best-effort; navigation still works without it.
      prefetchedRef.current.delete(href);
    }
  }

  function onNavClick(href: string, event: React.MouseEvent<HTMLAnchorElement>) {
    // Same destination already pending — ignore repeat clicks without blocking others.
    if (pendingHref === href) {
      event.preventDefault();
      return;
    }
    // Already on this exact route — no duplicate pending chrome.
    if (href === pathname) {
      event.preventDefault();
      return;
    }
    setPendingHref(href);
    armPendingTimeout();
    prefetchHref(href);
  }

  return (
    <div className="portal-shell bg-bg min-h-screen">
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
            'route-progress bg-green h-full w-1/4',
            navigating && 'motion-reduce:animate-none',
          )}
        />
      </div>

      {/* ── Mobile backdrop ── */}
      <SoftPanel
        open={mobileOpen}
        aria-hidden
        className="soft-scrim bg-ink/30 fixed inset-0 z-40 lg:hidden"
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside
        ref={sidebarRef}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label={mobileOpen ? labels.brand : undefined}
        data-mobile-open={mobileOpen}
        className={cn(
          'soft-sidebar border-border fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-[#f3f4f6]',
          collapsed ? 'lg:w-[4.5rem]' : 'lg:w-[232px]',
          'w-[260px]', // mobile drawer width
          mobileOpen ? 'visible translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className="border-border/70 flex h-[84px] items-center gap-2 border-b px-4">
          <Link
            href="/"
            className={cn(
              'flex min-w-0 items-center gap-2.5 overflow-hidden',
              collapsed && 'lg:hidden', // narrow rail shows only the collapse chevron
            )}
          >
            <BrandPlate className="h-8 shrink-0" />
            {!collapsed && (
              <span className="min-w-0 flex-1 leading-tight">
                <Wordmark
                  name={labels.brand}
                  className="font-display text-ink block text-[0.78rem] leading-tight font-bold whitespace-normal"
                />
                {labels.subtitle ? (
                  <span className="text-ink-3 mt-0.5 block text-[0.58rem]">{labels.subtitle}</span>
                ) : null}
              </span>
            )}
          </Link>

          {/* Desktop collapse toggle (Atlas-style chevron at the top of the rail) */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? labels.expand : labels.collapse}
            className={cn(
              'text-ink-3 hover:bg-surface hover:text-ink hidden rounded-md p-1.5 transition-colors lg:inline-flex',
              collapsed ? 'lg:mx-auto' : 'ml-auto',
            )}
          >
            {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
          </button>

          {/* Mobile drawer close */}
          <button
            type="button"
            data-drawer-close
            aria-label={labels.closeMenu}
            className="text-ink-2 hover:bg-surface ml-auto rounded-md p-1.5 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Nav — thin near-invisible scrollbar; scroll position persisted across layout remounts */}
        <nav
          ref={sidebarNavRef}
          className="shell-sidebar-nav flex-1 space-y-5 overflow-y-auto px-3 py-5"
          onScroll={(event) => {
            try {
              window.sessionStorage.setItem(
                SIDEBAR_SCROLL_KEY,
                String(event.currentTarget.scrollTop),
              );
            } catch {
              // Ignore quota / private-mode failures.
            }
          }}
        >
          {navSections.map((section, si) => (
            <div key={section.label ?? si} className="space-y-1">
              {section.label && !collapsed && (
                <p className="text-ink-3 px-3 pb-2 text-[11px] font-medium">{section.label}</p>
              )}
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                const visual = resolveNavItemVisualState({
                  pathname,
                  href: item.href,
                  exact: item.exact,
                  pendingHref,
                });
                const committed = isNavItemCommitted(pathname, item.href, item.exact);
                const active = visual === 'active';
                const pending = visual === 'pending';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    title={collapsed ? item.label : undefined}
                    aria-current={committed ? 'page' : undefined}
                    aria-busy={pending || undefined}
                    data-nav-state={visual}
                    onClick={(e) => onNavClick(item.href, e)}
                    onPointerEnter={() => prefetchHref(item.href)}
                    onFocus={() => prefetchHref(item.href)}
                    className={cn(
                      'group focus-visible:ring-green-light/30 flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none lg:min-h-9',
                      collapsed && 'lg:justify-center lg:px-0',
                      active &&
                        'text-ink bg-white font-semibold shadow-[0_1px_3px_rgb(24_32_42/0.08),0_0_0_1px_rgb(24_32_42/0.04)]',
                      pending && 'text-ink-2 bg-white/60 font-medium',
                      !active &&
                        !pending &&
                        'text-ink-2 hover:bg-surface-2 hover:text-ink font-medium',
                      pending && 'opacity-90',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        active || pending
                          ? 'text-green-strong'
                          : 'text-ink-3 group-hover:text-green-light',
                      )}
                    />
                    {!collapsed && (
                      <span className={cn('flex-1 truncate', pending && 'opacity-80')}>
                        {item.label}
                      </span>
                    )}
                    {!collapsed && pending ? (
                      <NavSpinner className="size-3.5" label={labels.navigating} />
                    ) : null}
                    {!collapsed && !pending && item.badge ? (
                      <span
                        className={cn(
                          'text-micro inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-white',
                          active ? 'bg-green-strong' : 'bg-green',
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
        <div className="border-border/70 border-t p-3">
          <div
            className={cn(
              'border-border flex items-center gap-2 rounded-lg border bg-white p-2',
              collapsed && 'lg:justify-center lg:bg-transparent lg:p-0',
            )}
          >
            <Link
              href="/profile"
              className="bg-green-soft text-micro text-green-strong flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
              title={user.name}
            >
              <ShellAvatar imageUrl={user.imageUrl} initials={user.initials} />
            </Link>
            {!collapsed && (
              <Link href="/profile" className="min-w-0 flex-1 leading-tight">
                <span className="text-small text-ink block truncate font-bold">{user.name}</span>
                <span className="text-ink-3 block truncate text-[11px]">{user.roleLabel}</span>
              </Link>
            )}
            <form action={signOutAction} className={cn(collapsed && 'lg:hidden')}>
              <button
                type="submit"
                aria-label={labels.signOut}
                title={labels.signOut}
                className="text-ink-3 hover:bg-surface hover:text-risk rounded-md p-1.5 transition-colors"
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
          'flex min-h-screen flex-col transition-[padding] duration-500 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none',
          collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-[232px]',
        )}
      >
        {/* Top bar */}
        <header className="border-border/75 sticky top-0 z-30 flex h-[64px] items-center gap-3 border-b bg-white/95 px-4 backdrop-blur-sm sm:px-7">
          <button
            type="button"
            aria-label={labels.openMenu}
            className="text-ink-2 hover:bg-surface-2 rounded-md p-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </button>

          <div className="text-small mr-auto hidden min-w-0 items-center gap-2 md:flex">
            <span className="text-ink-3">{user.roleLabel}</span>
            <ChevronRight className="text-ink-3/60 size-3" aria-hidden />
            <span className="text-ink truncate font-medium">
              {allItems.find((item) => isNavItemCommitted(pathname, item.href, item.exact))
                ?.label ?? labels.brand}
            </span>
          </div>
          {/* Global search — pages (client-side) + RBAC-scoped records (admins). */}
          <GlobalSearch navItems={allItems.map((i) => ({ label: i.label, href: i.href }))} />

          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher availableLocales={availableLocales} />
            <div className="relative">
              <button
                type="button"
                aria-label={labels.notifications}
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((o) => !o)}
                className="text-ink-2 hover:bg-surface-2 relative rounded-md p-2"
              >
                <Bell className="size-5" />
                {unread > 0 && (
                  <span className="bg-risk absolute top-1 right-1 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold text-white">
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
                </>
              )}
              <SoftPanel
                open={notifOpen}
                className="border-border bg-surface shadow-elevation-lg absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-xl border"
              >
                <div className="border-border border-b px-4 py-3">
                  <p className="text-small text-ink font-semibold">{labels.notificationsTitle}</p>
                </div>
                {recentStatus === 'loading' || recentStatus === 'idle' ? (
                  <div className="space-y-3 px-4 py-4" aria-busy="true">
                    <div className="bg-surface-2 h-10 animate-pulse rounded-md motion-reduce:animate-none" />
                    <div className="bg-surface-2 h-10 animate-pulse rounded-md motion-reduce:animate-none" />
                    <div className="bg-surface-2 h-10 animate-pulse rounded-md motion-reduce:animate-none" />
                  </div>
                ) : recentStatus === 'error' ? (
                  <p className="text-small text-ink-3 px-4 py-6 text-center">
                    {labels.noNotifications}
                  </p>
                ) : recent.length === 0 ? (
                  <p className="text-small text-ink-3 px-4 py-6 text-center">
                    {labels.noNotifications}
                  </p>
                ) : (
                  <ul className="divide-border max-h-80 divide-y overflow-y-auto">
                    {recent.map((n) => {
                      const inner = (
                        <div className="flex items-start gap-2">
                          {!n.read && (
                            <span
                              aria-hidden
                              className="bg-green mt-1.5 size-2 shrink-0 rounded-full"
                            />
                          )}
                          <div className={cn('min-w-0', n.read && 'pl-4')}>
                            <p className="text-small text-ink truncate font-medium">{n.title}</p>
                            {n.body && (
                              <p className="text-micro text-ink-2 line-clamp-2">{n.body}</p>
                            )}
                          </div>
                        </div>
                      );
                      return (
                        <li key={n.id} className={cn('px-4 py-3', !n.read && 'bg-green-soft/40')}>
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
                  className="border-border text-small text-green-strong hover:bg-surface-2 block border-t px-4 py-3 text-center font-medium"
                >
                  {labels.seeAll}
                </Link>
              </SoftPanel>
            </div>
            <Link
              href="/profile"
              aria-label={user.name}
              className="border-border bg-green-soft text-small text-green-strong hover:border-green-light ml-1 flex size-9 items-center justify-center overflow-hidden rounded-full border font-bold transition-colors"
            >
              <ShellAvatar imageUrl={user.imageUrl} initials={user.initials} />
            </Link>
          </div>
        </header>

        {/* Content — shell stays mounted; only this region swaps / refreshes. */}
        <main className="portal-content relative mx-auto w-full max-w-[1440px] flex-1 px-4 pt-5 pb-28 sm:px-7 lg:px-8 lg:pt-5 lg:pb-28">
          {isRefreshing ? (
            <div
              role="status"
              aria-live="polite"
              className="text-micro text-ink-3 pointer-events-none absolute top-5 right-4 z-10 flex items-center gap-1.5 sm:right-5"
            >
              <NavSpinner className="size-3.5" />
              <span>{labels.updating}</span>
            </div>
          ) : null}
          <AnimatedContent key={pathname} className="portal-page">
            {children}
          </AnimatedContent>
        </main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="border-border bg-bg fixed inset-x-0 bottom-0 z-30 flex border-t lg:hidden">
        {primary.map((item) => {
          const Icon = ICONS[item.icon];
          const visual = resolveNavItemVisualState({
            pathname,
            href: item.href,
            exact: item.exact,
            pendingHref,
          });
          const committed = isNavItemCommitted(pathname, item.href, item.exact);
          const active = visual === 'active';
          const pending = visual === 'pending';
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={committed ? 'page' : undefined}
              aria-busy={pending || undefined}
              data-nav-state={visual}
              onClick={(e) => onNavClick(item.href, e)}
              onPointerEnter={() => prefetchHref(item.href)}
              onFocus={() => prefetchHref(item.href)}
              className={cn(
                'text-micro flex min-h-11 flex-1 flex-col items-center gap-0.5 py-2 transition-colors duration-150',
                active && 'text-green-strong font-semibold',
                pending && 'text-green-strong/85',
                !active && !pending && 'text-ink-3',
              )}
            >
              <span className="relative">
                <Icon className="size-5" />
                {pending ? (
                  <NavSpinner
                    className="absolute -top-1 -right-2 size-3"
                    label={labels.navigating}
                  />
                ) : null}
              </span>
              <span className={cn('truncate', pending && 'opacity-80')}>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="text-micro text-ink-3 flex flex-1 flex-col items-center gap-0.5 py-2"
        >
          <Menu className="size-5" />
          <span>{labels.more}</span>
        </button>
      </nav>
    </div>
  );
}
