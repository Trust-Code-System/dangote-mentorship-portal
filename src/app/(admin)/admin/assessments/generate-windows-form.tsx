'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  generateAssessmentWindowsForm,
  type GenerateWindowsFormState,
} from '@/features/assessments/form-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Generates the cohort's assessment schedule from its start date. Idempotent:
// re-running only adds windows that don't exist yet, so an admin who extends a
// cohort can top up the schedule without losing their edits.
export function GenerateWindowsForm({
  cohortId,
  intervalMonths,
  graceDays,
  hasStartDate,
}: {
  cohortId: string;
  intervalMonths: number;
  graceDays: number;
  hasStartDate: boolean;
}) {
  const t = useTranslations('assessments');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState<GenerateWindowsFormState, FormData>(
    generateAssessmentWindowsForm,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-h3">{t('cadenceTitle')}</CardTitle>
        <p className="text-small text-ink-2">{t('cadenceHelp')}</p>
      </CardHeader>
      <CardContent>
        {!hasStartDate ? (
          <p className="text-small text-warn" role="alert">
            {t('needsStartDate')}
          </p>
        ) : (
          <form action={action} className="flex flex-wrap items-end gap-4">
            <input type="hidden" name="cohortId" value={cohortId} />

            <div className="space-y-1.5">
              <Label htmlFor="intervalMonths">{t('intervalMonths')}</Label>
              <Input
                id="intervalMonths"
                name="intervalMonths"
                type="number"
                min={1}
                max={24}
                defaultValue={intervalMonths}
                className="w-28"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="graceDays">{t('graceDays')}</Label>
              <Input
                id="graceDays"
                name="graceDays"
                type="number"
                min={0}
                max={90}
                defaultValue={graceDays}
                className="w-28"
                required
              />
            </div>

            <Button type="submit" disabled={pending}>
              {pending ? tc('loading') : t('generate')}
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
