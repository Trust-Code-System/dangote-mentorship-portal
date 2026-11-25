'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  archiveFormDefinitionForm,
  toggleFormDefinitionActiveForm,
  type FormDefinitionFormState,
} from '@/features/forms/form-actions';
import { Button } from '@/components/ui/button';

export function FormRowActions({ id, isActive }: { id: string; isActive: boolean }) {
  const t = useTranslations('forms');
  const tc = useTranslations('common');
  const [, toggleAction, togglePending] = useActionState<FormDefinitionFormState, FormData>(
    toggleFormDefinitionActiveForm,
    null,
  );
  const [, archiveAction, archivePending] = useActionState<FormDefinitionFormState, FormData>(
    archiveFormDefinitionForm,
    null,
  );

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/forms/${id}/preview`}>Preview</Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/forms/${id}/edit`}>{tc('edit')}</Link>
      </Button>

      <form action={toggleAction}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="outline" size="sm" disabled={togglePending}>
          {isActive ? t('deactivate') : t('activate')}
        </Button>
      </form>

      <form
        action={archiveAction}
        onSubmit={(e) => {
          if (!window.confirm(t('confirmArchive'))) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="ghost" size="sm" disabled={archivePending}>
          {tc('archive')}
        </Button>
      </form>
    </div>
  );
}
