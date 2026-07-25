import { getTranslations } from 'next-intl/server';
import { PublicLockup } from './public-lockup';
import { PublicLocaleToggle } from './public-locale-toggle';
import { PublicFooterLink } from './public-footer-link';

/**
 * The public footer — shared by the landing page and every Knowledge Library
 * page (PUBLIC_PAGES_MASTER_SPEC.md §8).
 *
 * Deep black, one fine top border, one restrained green glow, and three real
 * columns: Programme · Access · Language. It is the map of the public site, so
 * it marks where you currently are (`aria-current="page"` plus a visible green
 * marker — never colour alone).
 *
 * Only real destinations are linked:
 *  - **Confidentiality** now has its own page (`/confidentiality`); it used to
 *    point at `/faq` for want of one.
 *  - **Support** now has its own page (`/contact`); it used to be a `mailto:`.
 *    It is `/contact` rather than `/support` because `/support` is the
 *    authenticated participant request workflow and must stay gated
 *    (PUBLIC_PAGES_ROUTE_MAP.md §4).
 *  - **Privacy Policy** and **Terms of Service** are still **omitted**: neither
 *    a route nor approved copy exists, and pointing them at an unrelated page
 *    would be worse than leaving them out. Open owner item, spec §12.
 *
 * No invented social links.
 */
export async function PublicFooter() {
  const t = await getTranslations('landing.footer');
  const year = new Date().getFullYear();

  const programme = [
    { href: '/about', label: t('about') },
    { href: '/faq', label: t('faq') },
    { href: '/confidentiality', label: t('confidentiality') },
    { href: '/contact', label: t('support') },
  ];

  const access = [
    { href: '/login', label: t('signIn') },
    { href: '/signup', label: t('requestAccess') },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-blak-border/12 bg-blak-black px-4 pb-10 pt-20 sm:px-6">
      {/* The restrained green glow: a single wide, very low-opacity wash rising
          off the top border, so the footer reads as the base of the page rather
          than as a separate black box. Decorative only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgb(var(--blak-green)/0.10),transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-[1280px]">
        <div className="grid gap-12 md:grid-cols-[1.7fr_1fr_1fr_1fr] md:gap-8">
          <div className="max-w-md">
            <PublicLockup markClassName="size-9" wordmarkClassName="text-base" />
            <p className="mt-5 text-sm leading-relaxed text-blak-text-2">{t('statement')}</p>
          </div>

          <nav aria-label={t('sectionsLabel')}>
            <h2 className="text-blak-label uppercase text-blak-text-2">{t('sectionsLabel')}</h2>
            <ul className="mt-5 space-y-1">
              {programme.map((link) => (
                <li key={link.href}>
                  <PublicFooterLink href={link.href}>{link.label}</PublicFooterLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={t('accessLabel')}>
            <h2 className="text-blak-label uppercase text-blak-text-2">{t('accessLabel')}</h2>
            <ul className="mt-5 space-y-1">
              {access.map((link) => (
                <li key={link.href}>
                  <PublicFooterLink href={link.href}>{link.label}</PublicFooterLink>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-blak-label uppercase text-blak-text-2">{t('languageLabel')}</h2>
            <PublicLocaleToggle className="mt-5" />
            <p className="mt-3 max-w-[26ch] text-xs leading-relaxed text-blak-text-2/80">
              {t('languageHint')}
            </p>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-blak-border/10 pt-6 text-xs text-blak-text-2 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('copyright', { year })}</p>
          <p>{t('confidential')}</p>
        </div>
      </div>
    </footer>
  );
}
