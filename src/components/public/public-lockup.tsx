'use client';

import { useTranslations } from 'next-intl';
import { BrandMark } from '@/components/brand-logo';
import { cn } from '@/lib/utils';

/**
 * The programme lockup on a dark surface — the shared mark for every public
 * surface: the landing page, the Knowledge Library pages and the auth chrome.
 *
 * The wordmark is the localized programme name from `common.appName`; the
 * supplied BLAK MOH brand *mark* is deliberately unchanged beside it. Client
 * component purely so the name localizes — two of the three call sites are
 * server components, and NextIntlClientProvider wraps the whole app.
 *
 * Uses the **official supplied mark** (`public/brand/blak-moh-mark.png`, the
 * transparent "B/m") untouched, beside the wordmark set as live HTML text —
 * the same lockup structure the portal's `BrandLogo` already uses.
 *
 * Why not the full `blak-moh-original.png` lockup: that file has an opaque
 * `#F7F7F7` plate baked in and solid-black "BLAK" letterforms, so on a black
 * page it would render as a white box. A transparent dark-surface lockup asset
 * is an open owner item in PUBLIC_PAGES_MASTER_SPEC.md §12; if one is supplied
 * it drops straight in here.
 *
 * Colours are the exact logo values (`--blak-green` #14B21F, `--blak-gold`
 * #CD9933), which clear 7.4:1 and 8.2:1 on black.
 */
export function PublicLockup({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  const t = useTranslations('common');
  const PROGRAMME_NAME = t('appName');

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <BrandMark className={cn('size-8', markClassName)} />
      {/* role="img" so the aria-label is actually permitted here: a bare span maps
          to role generic, which prohibits a name, and support is inconsistent. */}
      <span
        role="img"
        aria-label={PROGRAMME_NAME}
        className={cn(
          'font-display text-[0.95rem] font-extrabold tracking-tight text-blak-text',
          wordmarkClassName,
        )}
      >
        {PROGRAMME_NAME}
      </span>
    </span>
  );
}
