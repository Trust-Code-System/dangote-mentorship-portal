'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

// Root segment boundary. Uses static copy (no next-intl) so a provider glitch
// cannot cascade into Next's default "This page couldn’t load" global screen.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-muted-foreground">
        Please try again. If the problem persists, contact an administrator.
      </p>
      <div className="flex gap-3">
        <Button type="button" onClick={retry}>
          Retry
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Back
        </Button>
      </div>
    </div>
  );
}
