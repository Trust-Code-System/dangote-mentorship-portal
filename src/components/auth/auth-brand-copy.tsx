'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * The headline and body in the auth brand panel.
 *
 * Every authentication page shares one shell, so the panel would otherwise tell
 * a first-time visitor on `/signup` to "continue your journey" — which they
 * have not begun. This swaps in request-access copy on that one route and
 * leaves every other page exactly as it was.
 *
 * A tiny client component rather than a prop threaded through the layout: a
 * Next.js layout cannot read the active path on the server, and `usePathname()`
 * is the smallest honest way to get it. The shell around it stays a server
 * component, and the copy still comes from the message catalogue in both
 * locales.
 */
export function AuthBrandCopy() {
  const t = useTranslations('auth');
  const pathname = usePathname();
  const requesting = pathname === '/signup';

  const eyebrow = t('brandEyebrow');
  const headline = requesting ? t('requestBrandHeadline') : t('brandHeadline');
  const accent = requesting ? t('requestBrandHeadlineAccent') : t('brandHeadlineAccent');
  const body = requesting ? t('requestBrandBody') : t('brandBody');

  return (
    <>
      <p className="text-small text-ink-2 font-medium">{eyebrow}</p>
      <h2 className="text-ink mt-5 text-[clamp(2.5rem,3.8vw,3.75rem)] leading-[1.08] font-medium tracking-[-0.05em]">
        {headline} <span className="text-green">{accent}</span>
      </h2>
      <p className="text-ink-2 mt-5 max-w-md text-base leading-relaxed">{body}</p>
    </>
  );
}
