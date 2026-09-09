'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { createCohortForm, type CohortFormState } from '@/features/cohorts/form-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CohortLanguageControl } from './cohort-language-control';

type ProgrammeOption = { id: string; name: string };

export function CohortCreateForm({ programmes }: { programmes: ProgrammeOption[] }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<CohortFormState, FormData>(
    createCohortForm,
    null,
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (programmes.length === 0) {
    return <p className="text-muted-foreground">{t('noProgrammes')}</p>;
  }

  return (
    <form ref={formRef} action={action} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="programmeId">{t('programmes')}</Label>
        <Select name="programmeId" required defaultValue={programmes[0]?.id}>
          <SelectTrigger id="programmeId">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {programmes.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">{t('cohortName')}</Label>
        <Input id="name" name="name" required maxLength={160} />
        {state && !state.ok && state.error.fieldErrors?.name ? (
          <p className="text-destructive text-sm">{state.error.fieldErrors.name[0]}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">{t('startDate')}</Label>
          <Input id="startDate" name="startDate" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">{t('endDate')}</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      </div>

      <CohortLanguageControl
        error={
          state && !state.ok && state.error.fieldErrors?.languages
            ? state.error.fieldErrors.languages[0]
            : undefined
        }
      />

      {state?.ok ? <p className="text-primary text-sm">{t('createdCohort')}</p> : null}
      {state && !state.ok && !state.error.fieldErrors ? (
        <p className="text-destructive text-sm">{tc('errorBody')}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {t('newCohort')}
      </Button>
    </form>
  );
}
