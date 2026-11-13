'use client';

import { useLocale } from 'next-intl';
import { useEffect, useTransition } from 'react';
import { setLocale } from '@/i18n/actions';
import { locales, type AppLocale } from '@/i18n/config';

// Keep the cohort's existing locale restriction without exposing a language
// switcher. A saved French preference must not strand an English-only cohort.
export function CohortLocaleGuard({
  availableLocales,
}: {
  availableLocales: readonly AppLocale[];
}) {
  const active = useLocale();
  const [, startTransition] = useTransition();
  const supported = availableLocales.length > 0 ? availableLocales : locales;
  const fallback = supported[0] ?? 'en';
  const activeSupported = supported.includes(active as AppLocale);

  useEffect(() => {
    if (activeSupported) return;
    startTransition(async () => {
      await setLocale(fallback);
    });
  }, [activeSupported, fallback]);

  return null;
}
