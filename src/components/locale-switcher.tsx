'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setLocale } from '@/i18n/actions';
import type { AppLocale } from '@/i18n/config';
import { Button } from '@/components/ui/button';

// Lets any user switch the interface language at any time (CLAUDE.md §16:
// never force French users into English).
export function LocaleSwitcher() {
  const active = useLocale();
  const t = useTranslations('locale');
  const [pending, startTransition] = useTransition();

  function choose(next: AppLocale) {
    if (next === active) return;
    startTransition(async () => {
      await setLocale(next);
    });
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('switch')}>
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
    </div>
  );
}
