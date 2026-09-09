'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useTransition } from 'react';
import { setLocale } from '@/i18n/actions';
import { locales, type AppLocale } from '@/i18n/config';
import { Button } from '@/components/ui/button';

// Public/admin surfaces offer every interface language. Participant layouts can
// narrow this to the languages their cohort operates in. If an admin turns a
// language off while somebody still has it selected, the switcher moves them to
// the cohort's remaining language instead of leaving them stranded.
export function LocaleSwitcher({
  availableLocales = locales,
}: {
  availableLocales?: readonly AppLocale[];
}) {
  const active = useLocale();
  const t = useTranslations('locale');
  const [pending, startTransition] = useTransition();
  const supported = availableLocales.length > 0 ? availableLocales : locales;
  const fallback = supported[0] ?? 'en';
  const activeSupported = supported.includes(active as AppLocale);

  function choose(next: AppLocale) {
    if (next === active) return;
    startTransition(async () => {
      await setLocale(next);
    });
  }

  useEffect(() => {
    if (activeSupported) return;
    startTransition(async () => {
      await setLocale(fallback);
    });
  }, [activeSupported, fallback]);

  if (supported.length === 1 && active === fallback) return null;

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('switch')}>
      {supported.includes('en') ? (
        <Button
          type="button"
          size="sm"
          variant={active === 'en' ? 'default' : 'ghost'}
          disabled={pending}
          onClick={() => choose('en')}
          aria-pressed={active === 'en'}
        >
          {t('en')}
        </Button>
      ) : null}
      {supported.includes('fr') ? (
        <Button
          type="button"
          size="sm"
          variant={active === 'fr' ? 'default' : 'ghost'}
          disabled={pending}
          onClick={() => choose('fr')}
          aria-pressed={active === 'fr'}
        >
          {t('fr')}
        </Button>
      ) : null}
    </div>
  );
}
