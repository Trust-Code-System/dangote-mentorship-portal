'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

/**
 * Recoverable in-shell error UI for authenticated segments. Keeps the AppShell
 * mounted (unlike the root global error screen) and retries via router.refresh
 * + boundary reset — never a full browser reload.
 */
export function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  function retry() {
    router.refresh();
    reset();
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="font-display text-h2 text-ink">{t('errorTitle')}</h2>
      <p className="max-w-md text-body text-ink-2">{t('errorBody')}</p>
      <Button type="button" onClick={retry}>
        {t('retry')}
      </Button>
    </div>
  );
}
