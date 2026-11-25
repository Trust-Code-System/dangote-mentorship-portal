'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

function Line({ className }: { className?: string }) {
  return <div className={cn('route-skeleton h-3', className)} />;
}

/** Keep the workspace stable while the incoming route streams its content. */
export function BrandedRouteLoader({
  tone = 'portal',
  className,
}: {
  tone?: 'portal' | 'dark';
  className?: string;
}) {
  const t = useTranslations('common');
  const pathname = usePathname() ?? '/';
  const isForm =
    /\/(profile|settings|assessment|monthly-form|mid-term-review|final-review|imports|invites|agreements)(\/|$)/.test(
      pathname,
    );
  const isDashboard = /\/(dashboard|admin)$|\/dashboard\/(mentor|mentee)$/.test(pathname);
  const isMessages = pathname.startsWith('/messages');
  const isCalendar = pathname.startsWith('/calendar');
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        'min-h-[50vh] space-y-7 py-1',
        tone === 'dark' && '[--border:60_60_64] [--ink:244_244_245] [--surface:24_24_27]',
        className,
      )}
    >
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden="true" className="space-y-7">
        <div className="space-y-3">
          <Line className="h-7 w-48" />
          <Line className="w-64 max-w-full" />
        </div>
        {isDashboard ? (
          <>
            <div className="border-border grid grid-cols-2 gap-5 rounded-lg border p-5 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-4">
                  <Line className="w-24" />
                  <Line className="h-8 w-16" />
                  <Line className="w-28" />
                </div>
              ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
              <Line className="h-64" />
              <Line className="h-64" />
            </div>
          </>
        ) : isForm ? (
          <div className="border-border bg-surface max-w-3xl space-y-7 rounded-lg border p-6">
            <Line className="h-5 w-36" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Line className="w-24" />
                <Line className={i === 2 ? 'h-24' : 'h-11'} />
              </div>
            ))}
            <Line className="ml-auto h-10 w-28" />
          </div>
        ) : isMessages ? (
          <div className="grid h-[50vh] grid-cols-[minmax(100px,1fr)_3fr] gap-5">
            <Line className="h-full" />
            <div className="flex flex-col gap-5 py-4">
              <Line className="w-2/3" />
              <Line className="ml-auto h-12 w-2/3" />
              <Line className="h-16 w-1/2" />
              <Line className="mt-auto h-11" />
            </div>
          </div>
        ) : isCalendar ? (
          <div className="border-border bg-border grid grid-cols-7 gap-px overflow-hidden rounded-lg border">
            {Array.from({ length: 35 }, (_, i) => (
              <div key={i} className="bg-surface h-20 p-2">
                <Line className="h-2 w-4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="border-border bg-surface overflow-hidden rounded-lg border">
            <div className="border-border flex gap-3 border-b p-4">
              <Line className="h-8 w-40" />
              <Line className="ml-auto h-8 w-24" />
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="border-border/60 flex items-center gap-5 border-b p-4 last:border-0"
              >
                <Line className="size-8 shrink-0 rounded-full" />
                <Line className="w-1/3" />
                <Line className="ml-auto w-1/5" />
                <Line className="hidden w-16 sm:block" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
