'use client';

import { useTranslations } from 'next-intl';
import { BrandMark, BrandPlate } from '@/components/brand-logo';
import { cn } from '@/lib/utils';

/**
 * The loading state for every route in the app.
 *
 * Content skeletons used to stand in for each page's layout, on the theory that
 * holding the shape in place reads as faster. In practice they read as a screen
 * of empty grey boxes — most visibly on routes that had no skeleton of their own
 * and inherited the *dashboard's* stat-card shape instead. The brand mark says
 * "working" more clearly than a grey approximation of the wrong page does, and
 * one loader across the app means loading always looks like the same thing.
 *
 * Reuses the root splash's `brand-splash-*` animations so the pre-shell splash
 * (`app/loading.tsx`) and this in-shell loader read as one system. Those
 * keyframes are already disabled under `prefers-reduced-motion` in globals.css.
 *
 * `tone` picks the track colour, because the app runs two token systems: the
 * portal's light `--surface-*` scale and the dark `--blak-*` scale used by the
 * landing, the Knowledge Library and the auth frame. The mark and the green bar
 * are legible on both; only the track behind the bar needs to change.
 */
export function BrandedRouteLoader({
  tone = 'portal',
  className,
}: {
  tone?: 'portal' | 'dark';
  className?: string;
}) {
  const t = useTranslations('common');

  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('flex min-h-[60vh] flex-col items-center justify-center gap-6', className)}
    >
      {/* Decorative: the accessible name comes from the status text below, so the
          mark's own alt text would just be a second, less useful announcement. */}
      <span aria-hidden="true" className="contents">
        {tone === 'dark' ? (
          <BrandMark className="brand-splash-mark h-11 w-auto" />
        ) : (
          <BrandPlate className="brand-splash-mark h-11" />
        )}
      </span>
      <div
        aria-hidden="true"
        className={cn(
          'h-1 w-32 overflow-hidden rounded-full',
          tone === 'dark' ? 'bg-blak-ivory/10' : 'bg-surface-2',
        )}
      >
        <div className="brand-splash-bar h-full w-1/3 rounded-full bg-green" />
      </div>
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
