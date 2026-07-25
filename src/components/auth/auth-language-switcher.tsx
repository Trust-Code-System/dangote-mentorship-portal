'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { setLocale } from '@/i18n/actions';
import type { AppLocale } from '@/i18n/config';
import { cn } from '@/lib/utils';

/**
 * Segmented English / Français control for the auth pages (AUTH_UI_SPEC.md).
 *
 * Replaces the cramped pair of buttons that sat directly on top of the form
 * fields. This is a proper segmented control: 44px minimum height, a clearly
 * filled selected state in brand green, and an unselected state that stays
 * readable rather than fading out.
 *
 * It calls the same `setLocale` server action the rest of the product uses — a
 * cookie write inside a transition, not a navigation. That matters here: **it
 * does not clear the form, reset authentication state, or lose a half-typed
 * email.** All validation and error copy re-renders in the new language because
 * every string comes from the message catalogue.
 *
 * `compact` is the mobile-header variant; the sizing floor is unchanged.
 */
export function AuthLanguageSwitcher({
  className,
  compact = false,
  tone = 'ivory',
}: {
  className?: string;
  compact?: boolean;
  /** `ivory` sits on the form card; `dark` sits on the branded header. */
  tone?: 'ivory' | 'dark';
}) {
  const active = useLocale();
  const t = useTranslations('locale');
  const ta = useTranslations('auth');
  const [pending, startTransition] = useTransition();

  function choose(next: AppLocale) {
    if (next === active) return;
    startTransition(async () => {
      await setLocale(next);
    });
  }

  const onDark = tone === 'dark' || compact;

  return (
    <div
      role="group"
      aria-label={ta('languageLabel')}
      className={cn(
        'inline-flex items-center rounded-full p-1',
        onDark ? 'border border-blak-border/15 bg-blak-black/50' : 'border border-auth-border bg-auth-field',
        pending && 'opacity-70',
        className,
      )}
    >
      {(['en', 'fr'] as const).map((code) => {
        const isActive = active === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => choose(code)}
            disabled={pending}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center justify-center rounded-full text-sm font-semibold transition-colors',
              // 44px total target height even in the compact variant.
              compact ? 'min-h-9 px-3' : 'min-h-11 px-5',
              isActive
                ? 'bg-blak-green text-blak-black'
                : onDark
                  ? 'text-blak-text-2 hover:text-blak-text'
                  : 'text-auth-ink-2 hover:text-auth-ink',
            )}
          >
            {t(code)}
          </button>
        );
      })}
    </div>
  );
}
