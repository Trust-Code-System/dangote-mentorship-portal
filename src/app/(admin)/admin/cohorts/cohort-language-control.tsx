'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';

export function CohortLanguageControl({
  defaultFrenchEnabled = true,
  error,
}: {
  defaultFrenchEnabled?: boolean;
  error?: string;
}) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');

  return (
    <fieldset className="space-y-3">
      <div>
        <legend className="text-body text-ink font-semibold">{t('programmeLanguages')}</legend>
        <p className="text-small text-ink-3 mt-1 max-w-2xl">{t('programmeLanguagesHelp')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-border bg-surface flex min-h-20 items-center justify-between gap-3 rounded-lg border px-4 py-3">
          <div className="min-w-0">
            <p className="text-body text-ink font-semibold">{tc('english')}</p>
            <p className="text-small text-ink-3 mt-0.5">{t('englishAlwaysOn')}</p>
          </div>
          <span className="bg-ok-soft text-small text-ok inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 font-semibold">
            <Check aria-hidden className="size-4" />
            {t('languageOn')}
          </span>
          <input type="hidden" name="languages" value="EN" />
        </div>

        <div className="group border-border bg-surface focus-within:border-primary focus-within:ring-primary/20 has-[:checked]:border-primary/40 has-[:checked]:bg-primary-soft relative min-h-20 rounded-lg border transition-colors focus-within:ring-2">
          <input
            id="cohort-french-enabled"
            className="peer sr-only"
            type="checkbox"
            role="switch"
            name="languages"
            value="FR"
            defaultChecked={defaultFrenchEnabled}
            aria-describedby="cohort-french-help"
          />
          <label
            htmlFor="cohort-french-enabled"
            className="flex min-h-20 cursor-pointer items-center justify-between gap-3 px-4 py-3"
          >
            <span className="min-w-0">
              <span className="text-body text-ink block font-semibold">{tc('french')}</span>
              <span id="cohort-french-help" className="text-small text-ink-3 mt-0.5 block">
                {t('frenchAvailabilityHelp')}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-small text-ink-3 font-semibold group-has-[:checked]:hidden">
                {t('languageOff')}
              </span>
              <span className="text-small text-primary hidden font-semibold group-has-[:checked]:inline">
                {t('languageOn')}
              </span>
              <span
                aria-hidden
                className="bg-ink-3/35 group-has-[:checked]:bg-primary relative h-7 w-12 rounded-full transition-colors after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform group-has-[:checked]:after:translate-x-5"
              />
            </span>
          </label>
        </div>
      </div>

      {error ? <p className="text-small text-destructive">{error}</p> : null}
    </fieldset>
  );
}
