'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  generateMonthlyWindowsForm,
  type GenerateWindowsFormState,
} from '@/features/assessments/form-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Generates one monthly meeting-form window per calendar month the cohort runs
// in. No options to set: the cadence is "every month" and it never gates
// access, so there is no interval or grace period to choose.
export function GenerateMonthlyForm({
  cohortId,
  hasStartDate,
}: {
  cohortId: string;
  hasStartDate: boolean;
}) {
  const t = useTranslations('assessments');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState<GenerateWindowsFormState, FormData>(
    generateMonthlyWindowsForm,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-h3">{t('monthlyCadenceTitle')}</CardTitle>
        <p className="text-small text-ink-2">{t('monthlyCadenceHelp')}</p>
      </CardHeader>
      <CardContent>
        {!hasStartDate ? (
          <p className="text-small text-warn" role="alert">
            {t('needsStartDate')}
          </p>
        ) : (
          <form action={action} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="cohortId" value={cohortId} />
            <Button type="submit" disabled={pending}>
              {pending ? tc('loading') : t('generateMonthly')}
            </Button>
            {state?.ok ? (
              <p className="text-small text-green-strong" role="status">
                {t('generated', { count: state.data.created })}
              </p>
            ) : null}
            {state && !state.ok ? (
              <p className="text-small text-risk" role="alert">
                {state.error.message}
              </p>
            ) : null}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
