'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import {
  installStandardFormsForm,
  type InstallStandardFormsState,
} from '@/features/forms/form-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Publishes the programme's standard question sets into this cohort.
//
// Forms are per-cohort by design, so every new cohort needs its own copies —
// and the sets run to 37 bilingual questions, which nobody should retype. The
// action is idempotent: it adds only what is missing and never touches a set an
// admin has already edited.
export function InstallStandardForms({
  cohortId,
  missingCount,
  totalCount,
}: {
  cohortId: string;
  missingCount: number;
  totalCount: number;
}) {
  const t = useTranslations('forms');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState<InstallStandardFormsState, FormData>(
    installStandardFormsForm,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-h3">{t('standardTitle')}</CardTitle>
        <p className="text-small text-ink-2">{t('standardHelp')}</p>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <form action={action}>
          <input type="hidden" name="cohortId" value={cohortId} />
          <Button type="submit" disabled={pending || missingCount === 0}>
            <Sparkles className="mr-1.5 size-4" aria-hidden />
            {pending ? tc('loading') : t('standardInstall', { count: missingCount })}
          </Button>
        </form>

        {missingCount === 0 ? (
          <p className="text-small text-green-strong" role="status">
            {t('standardAllPresent', { count: totalCount })}
          </p>
        ) : null}

        {state?.ok ? (
          <p className="text-small text-green-strong" role="status">
            {t('standardInstalled', { created: state.data.created, skipped: state.data.skipped })}
          </p>
        ) : null}
        {state && !state.ok ? (
          <p className="text-small text-risk" role="alert">
            {state.error.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
