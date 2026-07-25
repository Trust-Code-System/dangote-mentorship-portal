'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setLocale } from '@/i18n/actions';
import type { AppLocale } from '@/i18n/config';
import { cn } from '@/lib/utils';

/**
 * Language control for the dark public chrome — nav, mobile sheet and footer.
 *
 * Deliberately NOT a restyle of the shared `LocaleSwitcher` — that component
 * belongs to the light portal and this work does not touch portal components.
 * It calls the same `setLocale` server action, so behaviour is identical: a
 * cookie write inside a transition, which re-renders the server components in
 * place. That means **scroll position, FAQ search state and open accordions all
 * survive, and auth state is untouched** — it is not a navigation, so there is
 * no locale-specific URL to get wrong and nothing to preserve in the query
 * string.
 *
 * Accessibility: a real radio-style pair of buttons in a labelled group, with
 * `aria-pressed` reflecting the active locale, so the state is announced rather
 * than only shown as a colour. English and French are rendered identically —
 * neither is styled as the fallback.
 */
export function PublicLocaleToggle({ className }: { className?: string }) {
  const active = useLocale();
  const t = useTranslations('locale');
  const [pending, startTransition] = useTransition();

  function choose(next: AppLocale) {
    if (next === active) return;
    startTransition(async () => {
      await setLocale(next);
    });
  }

  const options: { code: AppLocale; label: string }[] = [
    { code: 'en', label: t('en') },
    { code: 'fr', label: t('fr') },
  ];

  return (
    <div
      role="group"
      aria-label={t('switch')}
      className={cn(
        // Hairline ivory at ~5% — enough to hold the pill on black, not a white ring.
        'inline-flex items-center gap-0.5 rounded-full border border-blak-border/[0.05] bg-blak-black/30 p-0.5',
        pending && 'opacity-70',
        className,
      )}
    >
      {options.map((option) => {
        const isActive = active === option.code;
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => choose(option.code)}
            disabled={pending}
            aria-pressed={isActive}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
              isActive
                ? 'bg-blak-green text-blak-black'
                : 'text-blak-text-2 hover:bg-blak-ivory/10 hover:text-blak-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
