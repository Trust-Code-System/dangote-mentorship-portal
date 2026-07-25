'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { Menu, X, ArrowRight } from 'lucide-react';
import { PublicLockup } from './public-lockup';
import { PublicLocaleToggle } from './public-locale-toggle';
import { useReducedMotion } from '@/app/(landing)/hooks/use-reduced-motion';
import { cn } from '@/lib/utils';

/** Landing-page anchor targets, in document order — drives the in-view indicator. */
const SECTIONS = ['programme', 'matching', 'journey', 'experience'] as const;
type SectionId = (typeof SECTIONS)[number];

/** The Knowledge Library, in footer order. Used on every non-landing public page. */
const LIBRARY = [
  { href: '/about', key: 'about' },
  { href: '/faq', key: 'faq' },
  { href: '/confidentiality', key: 'confidentiality' },
  { href: '/contact', key: 'support' },
] as const;

/**
 * Floating navigation shared by every public surface — the landing page and all
 * four Knowledge Library pages (PUBLIC_PAGES_MASTER_SPEC.md §4).
 *
 * One component, so the chrome cannot drift between routes: same glass plate,
 * same 1280px measure, same right cluster, same mobile sheet, same lockup.
 *
 * Only the **link set** varies, and deliberately:
 *  - On `/` the links are the page's own narrative anchors, tracked by an
 *    IntersectionObserver. That nav is the landing page's table of contents;
 *    replacing it with cross-page links would break the scroll story.
 *  - Everywhere else the links are the Library itself, with the current page
 *    marked by `aria-current="page"` and a pinned green rule.
 *
 * Deliberate restraint: no magnetic wobble, no gooey effect, and the sign-in
 * action is always visible — never folded into a menu, even on mobile, where it
 * sits in the bar itself rather than behind the toggle. One term for it
 * everywhere ("Sign in"), never "Login".
 */
export function PublicNav() {
  const t = useTranslations('landing.nav');
  const tf = useTranslations('landing.footer');
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<SectionId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const onLanding = pathname === '/';

  // Scrolled state — plain scroll listener, passive, no layout reads.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Active section (landing only). The top band of the viewport is the
  // "current" zone, so a section counts as active once its heading area is
  // under the floating bar.
  useEffect(() => {
    if (!onLanding) return;
    const nodes = SECTIONS.map((id) => document.getElementById(id)).filter(
      (node): node is HTMLElement => node !== null,
    );
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id as SectionId);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [onLanding]);

  // Close the mobile sheet on Escape and lock background scroll while it's open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Route changes must not leave the sheet open behind the new page.
  useEffect(() => setMenuOpen(false), [pathname]);

  const links: { id: string; href: string; label: string; current: boolean }[] = onLanding
    ? [
        { id: 'programme', href: '#programme', label: t('programme'), current: active === 'programme' },
        { id: 'matching', href: '#matching', label: t('matching'), current: active === 'matching' },
        { id: 'journey', href: '#journey', label: t('journey'), current: active === 'journey' },
        { id: 'experience', href: '#experience', label: t('experience'), current: active === 'experience' },
        { id: 'faq', href: '/faq', label: t('faq'), current: false },
      ]
    : LIBRARY.map((link) => ({
        id: link.key,
        href: link.href,
        label: tf(link.key),
        current: pathname === link.href,
      }));

  return (
    <motion.header
      initial={reduced ? false : { y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-4 z-50 px-4 sm:top-5 sm:px-6"
    >
      <nav
        aria-label={t('primaryLabel')}
        className={cn(
          'relative mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-4 rounded-[20px] border px-4 backdrop-blur-xl transition-colors duration-500 sm:px-5',
          scrolled
            ? 'border-blak-border/15 bg-blak-glass/85 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)]'
            : 'border-blak-border/10 bg-blak-glass/55',
        )}
      >
        {/* Internal top highlight — a light catching the glass edge. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-blak-ivory/25 to-transparent"
        />

        <Link href="/" aria-label={t('home')} className="shrink-0 rounded-md">
          <PublicLockup />
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <li key={link.id}>
              <Link
                href={link.href}
                aria-current={link.current ? (onLanding ? 'true' : 'page') : undefined}
                className={cn(
                  'group relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  link.current ? 'text-blak-text' : 'text-blak-text-2 hover:text-blak-text',
                )}
              >
                {link.label}
                {/* Quiet underline: grows on hover/focus, pinned open for the
                    current page or section. Colour is not the only signal — the
                    label also brightens and carries aria-current. */}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-3 -bottom-0.5 h-px origin-left bg-blak-green transition-transform duration-300',
                    link.current
                      ? 'scale-x-100'
                      : 'scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100',
                  )}
                />
              </Link>
            </li>
          ))}
        </ul>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-2">
          <PublicLocaleToggle className="hidden sm:inline-flex" />

          <Link
            href="/login"
            className="rounded-full px-3 py-2 text-sm font-semibold text-blak-text transition-colors hover:text-blak-green"
          >
            {t('signIn')}
          </Link>

          <Link
            href="/signup"
            className="hidden items-center gap-1.5 rounded-full bg-blak-green px-4 py-2 text-sm font-semibold text-blak-black transition-colors hover:bg-blak-green-soft sm:inline-flex"
          >
            {t('requestAccess')}
            <ArrowRight className="size-4" aria-hidden />
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            className="inline-flex size-11 items-center justify-center rounded-full border border-blak-border/15 text-blak-text lg:hidden"
          >
            <span className="sr-only">{menuOpen ? t('closeMenu') : t('openMenu')}</span>
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </nav>

      {/* Mobile sheet — plain disclosure, no transform trickery, so it stays
          usable with a keyboard and at 200% zoom. */}
      {menuOpen && (
        <div
          id="public-mobile-menu"
          className="mx-auto mt-2 max-h-[70vh] w-full max-w-[1280px] overflow-y-auto rounded-[20px] border border-blak-border/15 bg-blak-glass/95 p-4 backdrop-blur-xl lg:hidden"
        >
          <p className="px-2 pb-2 text-blak-label uppercase text-blak-text-2">{t('menuTitle')}</p>
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.id}>
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={link.current && !onLanding ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center rounded-lg px-2 py-3 text-base font-medium hover:bg-blak-ivory/10',
                    link.current ? 'text-blak-green-soft' : 'text-blak-text',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-blak-border/12 pt-4">
            <PublicLocaleToggle />
            <Link
              href="/signup"
              onClick={() => setMenuOpen(false)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-blak-green px-4 py-2.5 text-sm font-semibold text-blak-black"
            >
              {t('requestAccess')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </motion.header>
  );
}
