import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';
import { AuthLanguageSwitcher } from './auth-language-switcher';

/**
 * The warm ivory form surface (AUTH_UI_SPEC.md §2).
 *
 * Ivory rather than pure white, so it reads as paper against the cinematic
 * page instead of as a system dialog, and warm rather than cool so it sits with
 * the gold half of the palette. Ink on this surface is 17.4:1.
 */
export function AuthCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-[26px] border border-auth-border/70 bg-auth-surface p-7 shadow-[0_1px_2px_rgba(0,0,0,0.2),0_30px_60px_-24px_rgba(0,0,0,0.75)] sm:p-9',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Card header: the "Enterprise Portal" label and language control on one row,
 * then the heading and its supporting line.
 *
 * The full logo lockup is deliberately not repeated here — it is already
 * prominent in the brand panel on desktop and in the mobile header strip, and
 * repeating it a third time would push the form itself below the fold.
 */
export async function AuthHeader({
  heading,
  supporting,
}: {
  heading: string;
  supporting?: string;
}) {
  const t = await getTranslations('auth');

  return (
    <div className="mb-7">
      {/* The label and the switcher share a row only when there is room for
          both. At 320–390px "Français" was being clipped by the card edge, so
          below `sm` the switcher gets its own line. */}
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="whitespace-nowrap text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-auth-ink-2 sm:tracking-[0.14em]">
          {t('enterprisePortal')}
        </span>
        <AuthLanguageSwitcher />
      </div>

      <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-auth-ink">
        {heading}
      </h1>
      {supporting ? <p className="mt-2.5 text-base leading-relaxed text-auth-ink-2">{supporting}</p> : null}
    </div>
  );
}

/**
 * Footer beneath the card: the trust note, then only links that actually work
 * for a signed-out visitor.
 *
 * Both links now point at real public pages. Previously "Confidentiality" went
 * to `/faq` (no confidentiality page existed) and "Support" was a `mailto:`
 * (the `/support` route lives in `(dashboard)` and is auth-gated, so clicking
 * it while locked out bounced straight back to `/login`). The public Knowledge
 * Library supplies both destinations: `/confidentiality`, and `/contact` — the
 * public support page, which routes a locked-out visitor to password reset,
 * invitation help or the FAQ.
 *
 * **Terms of Service** stays omitted: no route and no approved copy exist, so
 * pointing it at an unrelated page would be worse than leaving it out
 * (PUBLIC_PAGES_MASTER_SPEC.md §12).
 */
export async function AuthFooter({ showTrustNote = true }: { showTrustNote?: boolean }) {
  const t = await getTranslations('auth');

  const linkClass =
    'inline-flex min-h-11 items-center text-blak-text-2 transition-colors hover:text-blak-text';

  return (
    <footer className="mt-8 text-center">
      {showTrustNote ? (
        <p className="mx-auto max-w-[38ch] text-xs leading-relaxed text-blak-text-2">
          {t('trustNote')}
        </p>
      ) : null}

      <nav className="mt-2 flex flex-wrap items-center justify-center gap-x-6 text-sm">
        <Link href="/confidentiality" className={linkClass}>
          {t('footerPrivacy')}
        </Link>
        <Link href="/contact" className={linkClass}>
          {t('footerSupport')}
        </Link>
        <Link href="/" className={linkClass}>
          {t('footerBackHome')}
        </Link>
      </nav>

      <p className="mt-1 text-xs text-blak-text-2/70">{t('copyright')}</p>
    </footer>
  );
}
