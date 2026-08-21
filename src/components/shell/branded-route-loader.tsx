'use client';

import { useTranslations } from 'next-intl';
import { BrandMark } from '@/components/brand-logo';

/**
 * Branded Suspense fallback for routes that have no skeleton of their own.
 *
 * The app loads in two tiers. The root `app/loading.tsx` splash covers full page
 * loads, where there is no shell yet. Inside the shell, a page whose layout is
 * known gets a content skeleton, because holding the real layout in place reads
 * as faster than replacing it. But a handful of routes — certificate,
 * final-review, help, mid-term-review — have no skeleton of their own and fell
 * back to the *dashboard's* four-stat-card skeleton, which is not their shape at
 * all: it just looked like a screen of empty grey boxes. For those, the brand
 * mark says "working" far better than a skeleton of the wrong page does.
 *
 * Deliberately reuses the root splash's `brand-splash-*` animations so the two
 * tiers read as one system rather than two loaders. Those keyframes are already
 * disabled under `prefers-reduced-motion` in globals.css.
 */
export function BrandedRouteLoader() {
  const t = useTranslations('common');

  return (
    <div
      role="status"
      aria-busy="true"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6"
    >
      {/* Decorative: the accessible name comes from the status text below, so the
          mark's own alt text would just be a second, less useful announcement. */}
      <span aria-hidden="true" className="contents">
        <BrandMark className="brand-splash-mark size-16" />
      </span>
      <div aria-hidden="true" className="h-1 w-32 overflow-hidden rounded-full bg-surface-2">
        <div className="brand-splash-bar h-full w-1/3 rounded-full bg-green" />
      </div>
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
